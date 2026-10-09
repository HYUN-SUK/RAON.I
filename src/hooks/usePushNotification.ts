'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { firebaseRequestPermission } from '@/lib/firebase';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { useRouter } from 'next/navigation';

export function usePushNotification() {
    const router = useRouter();
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [fcmToken, setFcmToken] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // 1. 웹 브라우저 환경 알림 상태 초기화
        if ('Notification' in window) {
            setPermission(Notification.permission);
        }

        // 2. [Capacitor] 네이티브 앱 환경인 경우 PushNotifications 리스너 바인딩
        if (Capacitor.isNativePlatform()) {
            console.log('[Push] Native Capacitor Platform detected.');

            // 기본 알림 채널 보장 (Android 8.0+)
            PushNotifications.createChannel({
                id: 'raon_notifications',
                name: '라온아이 알림',
                description: '캠핑장 예약 알림 및 스마트 여행 플랜',
                importance: 5,
                visibility: 1,
                sound: 'default',
                vibration: true,
                lights: true,
                lightColor: '#22C55E'
            }).catch((err) => console.warn('[Capacitor Push] Channel creation warning:', err));

            // 토큰 발급 리스너
            let regHandler: any = null;
            let errHandler: any = null;

            PushNotifications.addListener('registration', async (token) => {
                console.log('[Capacitor Push] Device Registration Token:', token.value);
                setFcmToken(token.value);
                if (typeof window !== 'undefined') {
                    localStorage.setItem('last_fcm_token_raw', token.value);
                }

                try {
                    const supabase = createClient();
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        const userCacheKey = `last_synced_fcm_token_${user.id}`;
                        const lastToken = localStorage.getItem(userCacheKey);
                        if (lastToken !== token.value) {
                            await supabase.from('push_tokens').upsert({
                                token: token.value,
                                user_id: user.id,
                                device_type: Capacitor.getPlatform() === 'ios' ? 'ios' : 'android',
                                is_active: true,
                                last_updated_at: new Date().toISOString()
                            });
                            localStorage.setItem(userCacheKey, token.value);
                            console.log('[Capacitor Push] Token synced to Supabase for user:', user.id);
                        }
                    }
                } catch (err) {
                    console.warn('[Capacitor Push] Token sync error:', err);
                }
            }).then(h => { regHandler = h; });

            // 토큰 에러 리스너
            PushNotifications.addListener('registrationError', (error) => {
                console.warn('[Capacitor Push] Registration Error:', error);
            }).then(h => { errHandler = h; });

            // (※ 포그라운드 알림 수신 및 클릭 처리는 NativeAppBridge에서 상시 전역으로 총괄)

            // 앱 구동 시 권한 상태 확인 및 자동 등록 시도
            PushNotifications.checkPermissions().then((status) => {
                if (status.receive === 'granted') {
                    PushNotifications.register();
                }
            });

            return () => {
                if (regHandler) regHandler.remove();
                if (errHandler) errHandler.remove();
            };
        }

        // 3. [v12.0.1 레거시 브릿지 호환] 안드로이드 전역 브릿지 함수 바인딩
        (window as any).onReceiveAndroidToken = async (token: string) => {
            console.log('[Android Bridge] Received Device Token:', token);
            if (!token) return;
            if (typeof window !== 'undefined') {
                localStorage.setItem('last_fcm_token_raw', token);
            }

            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();

                if (user) {
                    const userCacheKey = `last_synced_fcm_token_${user.id}`;
                    const lastToken = localStorage.getItem(userCacheKey);
                    if (lastToken !== token) {
                        const { error: upsertErr } = await supabase.from('push_tokens').upsert({
                            token,
                            user_id: user.id,
                            device_type: 'android',
                            is_active: true,
                            last_updated_at: new Date().toISOString()
                        });

                        if (!upsertErr) {
                            localStorage.setItem(userCacheKey, token);
                            console.log('[Android Bridge] Device Token successfully synced to Supabase for user:', user.id);
                        }
                    }
                }
            } catch (err) {
                console.warn('[Android Bridge] Error in token handler:', err);
            }
        };

        return () => {
            if (typeof window !== 'undefined') {
                delete (window as any).onReceiveAndroidToken;
            }
        };
    }, [router]);

    const requestPermission = useCallback(async (force?: boolean): Promise<string | null> => {
        if (typeof window === 'undefined') return null;

        // [Capacitor] 네이티브 앱 환경인 경우
        if (Capacitor.isNativePlatform()) {
            try {
                const permResult = await PushNotifications.requestPermissions();
                if (permResult.receive === 'granted') {
                    await PushNotifications.register();
                    if (force) {
                        toast.success('알림 수신 권한 설정이 완료되었습니다! 🔔');
                    }
                    return 'native-registered';
                } else {
                    if (force) {
                        toast.error('알림 권한을 승인받지 못했습니다. 앱 설정에서 권한을 허용해 주세요.');
                    }
                    return null;
                }
            } catch (err: any) {
                console.warn('[Capacitor Push] Permission error:', err);
                if (force) toast.error('알림 설정 도중 오류가 발생했습니다.');
                return null;
            }
        }

        // [Web] 브라우저 환경인 경우
        try {
            const token = await firebaseRequestPermission();
            setPermission(Notification.permission);

            if (token) {
                setFcmToken(token);
                if (typeof window !== 'undefined') {
                    localStorage.setItem('last_fcm_token_raw', token);
                }

                // Internal Sync Logic (Stable)
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();

                if (user) {
                    // [SYNC GUARD] Prevent redundant writes if token hasn't changed (unless forced)
                    const userCacheKey = `last_synced_fcm_token_${user.id}`;
                    const lastToken = localStorage.getItem(userCacheKey);
                    if (lastToken === token && !force) {
                        console.log('[Push] Token already synced for user:', user.id);
                        if (force) {
                            toast.success('이미 알림 설정이 완료되어 있습니다! 🔔');
                        }
                    } else {
                        await supabase.from('push_tokens').upsert({
                            token,
                            user_id: user.id,
                            device_type: 'web',
                            is_active: true,
                            last_updated_at: new Date().toISOString()
                        });
                        localStorage.setItem(userCacheKey, token);
                        console.log(`[Push] Token synced to Supabase for user ${user.id} (force: ${!!force})`);
                        if (force) {
                            toast.success('알림 수신 권한 설정이 완료되었습니다! 🔔');
                        }
                    }
                } else {
                    if (force) {
                        toast.error('로그인이 필요한 서비스입니다.');
                    }
                }
                return token;
            } else {
                if (Notification.permission === 'denied') {
                    console.warn('Notification permission denied');
                    if (force) {
                        toast.error('브라우저 설정에서 알림 권한이 차단되어 있습니다. 허용 후 다시 시도해 주세요.');
                    }
                } else {
                    if (force) {
                        toast.error('알림 권한을 승인받지 못했습니다.');
                    }
                }
                return null;
            }
        } catch (error: any) {
            // [v11.9.150] Permission request failed 에러를 console.error 대신 console.warn으로 로깅하여
            // 개발자 도구의 intercept-console-error.js에 의한 순간 렉(Thread Blocking)을 완벽히 회피
            console.warn('[Push] Permission request handled safely:', error?.message || error);
            if (force) {
                toast.error('알림 동기화 도중 오류가 발생했습니다.');
            }
            return null;
        }
    }, []); // Zero dependencies = Guaranteed Stability

    return {
        permission,
        fcmToken,
        requestPermission
    };
}
