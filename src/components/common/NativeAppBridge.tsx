'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import RaonLoading from '@/components/common/RaonLoading';

export default function NativeAppBridge() {
    const router = useRouter();
    const pathname = usePathname();
    const lastBackPressRef = useRef<number>(0);
    const [isNavigating, setIsNavigating] = useState(false);
    const [navigatingMessage, setNavigatingMessage] = useState('해당 화면으로 이동하고 있습니다... 🏕️');
    const targetPathRef = useRef<string | null>(null);
    const navigationStartTimeRef = useRef<number>(0);
    const safetyTimerRef = useRef<NodeJS.Timeout | null>(null);

    // 목적지 URL에 따른 안내 문구 동적 결정
    const getTransitionMessage = useCallback((url: string) => {
        if (url.includes('/notifications')) return '🔔 알림 내역으로 이동하고 있습니다...';
        if (url.includes('/reservation')) return '⛺ 실시간 예약 화면으로 이동하고 있습니다...';
        if (url.includes('/myspace/schedule')) return '🏕️ 맞춤 스마트플랜으로 이동하고 있습니다...';
        if (url.includes('/myspace/reservations')) return '📋 예약 상세 내역으로 이동하고 있습니다...';
        return '🏕️ 해당 화면으로 이동하고 있습니다...';
    }, []);

    const triggerNavigation = useCallback((targetUrl: string) => {
        if (!targetUrl) return;

        // 경로 비교용 순수 pathname 추출 (쿼리스트링, 해시 제외)
        const purePath = targetUrl.split('?')[0].split('#')[0];
        targetPathRef.current = purePath;
        navigationStartTimeRef.current = Date.now();

        setNavigatingMessage(getTransitionMessage(targetUrl));
        setIsNavigating(true);

        try { router.prefetch(targetUrl); } catch (_) {}
        router.replace(targetUrl);

        // [이중 안전 타이머] 네트워크 지연이나 예외 발생 시에도 최대 4.5초 후에는 무조건 해제하여 프리징 방지
        if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = setTimeout(() => {
            setIsNavigating(false);
            targetPathRef.current = null;
        }, 4500);
    }, [router, getTransitionMessage]);

    // 경로가 목적지에 도달했을 때 최소 노출 시간(700ms) 보장 후 부드럽게 해제
    useEffect(() => {
        if (!isNavigating || !targetPathRef.current) return;

        const currentPurePath = pathname.split('?')[0].split('#')[0];
        const isDestinationReached =
            currentPurePath === targetPathRef.current ||
            (targetPathRef.current !== '/' && currentPurePath.startsWith(targetPathRef.current));

        if (isDestinationReached) {
            const elapsed = Date.now() - navigationStartTimeRef.current;
            const remaining = Math.max(0, 700 - elapsed);
            const dismissTimer = setTimeout(() => {
                setIsNavigating(false);
                targetPathRef.current = null;
            }, remaining);

            return () => clearTimeout(dismissTimer);
        }
    }, [pathname, isNavigating]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        let cleanup: (() => void) | undefined;

        const setupNativeBridge = async () => {
            try {
                const { Capacitor } = await import('@capacitor/core');
                if (!Capacitor.isNativePlatform()) return;

                // 캐패시터 정식 네이티브 앱 환경 표시 (CSS Safe Area 격리용)
                document.documentElement.classList.add('is-native-app');

                const { App } = await import('@capacitor/app');
                const { PushNotifications } = await import('@capacitor/push-notifications');

                // ⚡ [0순위 최우선 등록] 알림 탭(터치) 리스너를 0.00초 순간에 최우선 바인딩 (지연 0ms)
                const pushActionHandler = await PushNotifications.addListener(
                    'pushNotificationActionPerformed',
                    (action) => {
                        console.log('[Native Bridge] Notification Action Performed:', action);
                        const data = action.notification?.data;
                        const link = data?.link || data?.route || '/notifications';
                        if (link) {
                            triggerNavigation(link);
                        }
                    }
                );

                // 1. Android 알림 채널 생성 (헤드업 팝업 및 고음질 알림 보장)
                PushNotifications.createChannel({
                    id: 'raon_notifications',
                    name: '라온아이 알림',
                    description: '캠핑장 예약 알림 및 스마트 여행 플랜',
                    importance: 5, // NotificationManager.IMPORTANCE_HIGH
                    visibility: 1, // NotificationCompat.VISIBILITY_PUBLIC
                    sound: 'default',
                    vibration: true,
                    lights: true,
                    lightColor: '#22C55E'
                }).catch((channelErr) => {
                    console.warn('[Native Bridge] Notification channel setup notice:', channelErr);
                });

                // 2. 하드웨어 뒤로가기(Back Button) 리스너
                const backHandler = await App.addListener('backButton', ({ canGoBack }) => {
                    // 모달이나 팝업 다이얼로그가 열려있는 경우 닫기 버튼 우선 트리거
                    const openCloseBtn = document.querySelector(
                        '[role="dialog"] button[aria-label="Close"], [role="dialog"] button.close-btn'
                    ) as HTMLElement | null;

                    if (openCloseBtn) {
                        openCloseBtn.click();
                        return;
                    }

                    const currentPath = window.location.pathname;
                    const isRoot = currentPath === '/' || currentPath === '/login';

                    if (!isRoot && window.history.length > 1) {
                        window.history.back();
                    } else {
                        const now = Date.now();
                        if (now - lastBackPressRef.current < 2000) {
                            App.exitApp();
                        } else {
                            lastBackPressRef.current = now;
                            toast.info('한 번 더 누르면 앱이 종료됩니다.', {
                                duration: 2000,
                            });
                        }
                    }
                });

                // 3. 앱 딥링크 / 외부 스키마 오픈 리스너
                const urlOpenHandler = await App.addListener('appUrlOpen', (data) => {
                    try {
                        const url = new URL(data.url);
                        const targetPath = url.pathname + url.search + url.hash;
                        if (targetPath) {
                            triggerNavigation(targetPath);
                        }
                    } catch (e) {
                        console.warn('[Native Bridge] URL Open parse error:', e);
                    }
                });

                // 4. 앱 복귀 시 (2차 인증 문자/카카오톡 확인 후 복귀) 네트워크 소켓 즉시 활성화 리스너
                const appStateChangeHandler = await App.addListener('appStateChange', ({ isActive }) => {
                    if (isActive && typeof window !== 'undefined') {
                        try {
                            window.dispatchEvent(new Event('online'));
                        } catch (e) {}
                    }
                });

                // 5. [포그라운드 푸시] 앱 실행 중 실시간 알림 수신 배너 노출
                const pushReceivedHandler = await PushNotifications.addListener(
                    'pushNotificationReceived',
                    (notification) => {
                        console.log('[Native Bridge] Foreground Notification Received:', notification);
                        const title = notification.title || '🔔 라온아이 알림';
                        const body = notification.body || '';
                        const link = notification.data?.link || notification.data?.route || '/notifications';

                        toast(title, {
                            description: body,
                            duration: 6000,
                            icon: '🔔',
                            action: link ? {
                                label: '확인',
                                onClick: () => {
                                    triggerNavigation(link);
                                }
                            } : undefined,
                        });
                    }
                );

                // 6. [전역 푸시 토큰 등록 및 계정 동기화]
                const regHandler = await PushNotifications.addListener('registration', async (token) => {
                    console.log('[Native Bridge] Device Push Token:', token.value);
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('last_fcm_token_raw', token.value);
                    }
                    try {
                        const { createClient } = await import('@/lib/supabase-client');
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
                                console.log('[Native Bridge] Device Token synced to Supabase for user:', user.id);
                            }
                        }
                    } catch (tSyncErr) {
                        console.warn('[Native Bridge] Token sync error:', tSyncErr);
                    }
                });

                PushNotifications.checkPermissions().then((status) => {
                    if (status.receive === 'granted') {
                        PushNotifications.register();
                    }
                });

                // 7. [로그인 상태 변경 실시간 감지 및 즉각 토큰 바인딩]
                const { createClient } = await import('@/lib/supabase-client');
                const supabase = createClient();
                const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(async (event, session) => {
                    if (event === 'SIGNED_IN' && session?.user) {
                        const rawToken = typeof window !== 'undefined' ? localStorage.getItem('last_fcm_token_raw') : null;
                        if (rawToken) {
                            const userCacheKey = `last_synced_fcm_token_${session.user.id}`;
                            if (localStorage.getItem(userCacheKey) !== rawToken) {
                                try {
                                    await supabase.from('push_tokens').upsert({
                                        token: rawToken,
                                        user_id: session.user.id,
                                        device_type: Capacitor.isNativePlatform() ? (Capacitor.getPlatform() === 'ios' ? 'ios' : 'android') : 'web',
                                        is_active: true,
                                        last_updated_at: new Date().toISOString()
                                    });
                                    localStorage.setItem(userCacheKey, rawToken);
                                    console.log('[Native Bridge] Auth state changed: Device Token successfully bound to user:', session.user.id);
                                } catch (e) {
                                    console.warn('[Native Bridge] Auth token binding warning:', e);
                                }
                            }
                        }
                    }
                });

                cleanup = () => {
                    pushActionHandler.remove();
                    backHandler.remove();
                    urlOpenHandler.remove();
                    appStateChangeHandler.remove();
                    pushReceivedHandler.remove();
                    regHandler.remove();
                    authSub.unsubscribe();
                };
            } catch (err) {
                console.warn('[Native Bridge] Error initializing native listeners:', err);
            }
        };

        setupNativeBridge();

        return () => {
            if (cleanup) cleanup();
            if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
        };
    }, [triggerNavigation]);

    if (!isNavigating) return null;

    return (
        <div
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-sm px-6 py-4 bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl rounded-3xl shadow-2xl border-2 border-emerald-500/30 flex items-center gap-4 animate-in fade-in slide-in-from-top-6 duration-300 pointer-events-none"
            style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
            role="status"
            aria-live="polite"
        >
            <RaonLoading size="md" />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-stone-800 dark:text-stone-100 leading-snug break-keep">
                    {navigatingMessage}
                </p>
                <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    잠시만 기다려주세요
                </p>
            </div>
        </div>
    );
}
