'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase-client';

import { toast } from 'sonner';
import { firebaseRequestPermission } from '@/lib/firebase';

export function usePushNotification() {
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [fcmToken, setFcmToken] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setPermission(Notification.permission);
        }
    }, []);

    const requestPermission = useCallback(async (force?: boolean) => {
        if (typeof window === 'undefined') return;

        try {
            const token = await firebaseRequestPermission();
            setPermission(Notification.permission);

            if (token) {
                setFcmToken(token);

                // Internal Sync Logic (Stable)
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();

                if (user) {
                    // [SYNC GUARD] Prevent redundant writes if token hasn't changed (unless forced)
                    const lastToken = localStorage.getItem('last_synced_fcm_token');
                    if (lastToken === token) {
                        console.log('[Push] Token already synced. Skipping...');
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
                        localStorage.setItem('last_synced_fcm_token', token);
                        console.log(`[Push] Token synced to Supabase (force: ${!!force})`);
                        if (force) {
                            toast.success('알림 수신 권한 설정이 완료되었습니다! 🔔');
                        }
                    }
                } else {
                    if (force) {
                        toast.error('로그인이 필요한 서비스입니다.');
                    }
                }
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
            }
        } catch (error: any) {
            // [v11.9.150] Permission request failed 에러를 console.error 대신 console.warn으로 로깅하여
            // 개발자 도구의 intercept-console-error.js에 의한 순간 렉(Thread Blocking)을 완벽히 회피
            console.warn('[Push] Permission request handled safely:', error?.message || error);
            if (force) {
                toast.error('알림 동기화 도중 오류가 발생했습니다.');
            }
        }
    }, []); // Zero dependencies = Guaranteed Stability

    return {
        permission,
        fcmToken,
        requestPermission
    };
}
