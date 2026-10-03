'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function NativeAppBridge() {
    const router = useRouter();
    const lastBackPressRef = useRef<number>(0);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        let cleanup: (() => void) | undefined;

        const setupNativeBridge = async () => {
            try {
                const { Capacitor } = await import('@capacitor/core');
                if (!Capacitor.isNativePlatform()) return;

                const { App } = await import('@capacitor/app');
                const { PushNotifications } = await import('@capacitor/push-notifications');

                // 1. Android 알림 채널(Notification Channel) 생성 (헤드업 팝업 및 고음질 알림 보장)
                try {
                    await PushNotifications.createChannel({
                        id: 'raon_notifications',
                        name: '라온아이 알림',
                        description: '캠핑장 예약 알림 및 스마트 여행 플랜',
                        importance: 5, // NotificationManager.IMPORTANCE_HIGH
                        visibility: 1, // NotificationCompat.VISIBILITY_PUBLIC
                        sound: 'default',
                        vibration: true,
                        lights: true,
                        lightColor: '#22C55E'
                    });
                    console.log('[Native Bridge] Notification Channel (raon_notifications) ready.');
                } catch (channelErr) {
                    console.warn('[Native Bridge] Notification channel setup notice:', channelErr);
                }

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

                    const pathname = window.location.pathname;
                    const isRoot = pathname === '/' || pathname === '/login';

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
                            router.push(targetPath);
                        }
                    } catch (e) {
                        console.warn('[Native Bridge] URL Open parse error:', e);
                    }
                });

                cleanup = () => {
                    backHandler.remove();
                    urlOpenHandler.remove();
                };
            } catch (err) {
                console.warn('[Native Bridge] Error initializing native listeners:', err);
            }
        };

        setupNativeBridge();

        return () => {
            if (cleanup) cleanup();
        };
    }, [router]);

    return null;
}
