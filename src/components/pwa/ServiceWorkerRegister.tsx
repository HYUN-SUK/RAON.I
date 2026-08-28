"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { getMessagingInstance } from "@/lib/firebase";
import { onMessage } from "firebase/messaging";

export default function ServiceWorkerRegister() {
    useEffect(() => {
        // 1. Service Worker Registration
        if ('serviceWorker' in navigator) {
            const registerSW = async () => {
                try {
                    // Check if already registered
                    const existingRegs = await navigator.serviceWorker.getRegistrations();
                    const isAlreadyRegistered = existingRegs.some(reg => reg.active && reg.active.scriptURL.includes('firebase-messaging-sw.js'));

                    if (isAlreadyRegistered) {
                        console.log('[SW] Already registered and active. Skipping...');
                        return;
                    }

                    // [1-1] Optional Versioned Reset (Uncomment if substantial SW changes occur)
                    /*
                    const SW_VERSION = 'v1.1';
                    if (localStorage.getItem('sw_version') !== SW_VERSION) {
                        for (let reg of existingRegs) await reg.unregister();
                        localStorage.setItem('sw_version', SW_VERSION);
                    }
                    */

                    // [1-2] Clean Registration
                    await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                    console.log('[SW] Clean worker registered');
                } catch (err) {
                    console.error('[SW] Registration failed:', err);
                }
            };
            registerSW();

            // 2. Message Listener (Service Worker -> Client)
            const handleMessage = (event: MessageEvent) => {
                if (event.data && event.data.type === 'NOTIFICATION_CLICK' && event.data.url) {
                    window.location.href = event.data.url;
                }
            };
            navigator.serviceWorker.addEventListener('message', handleMessage);

            // 3. Foreground Message Listener (Firebase SDK) - ENABLED
            const initForegroundMessage = async () => {
                const messaging = await getMessagingInstance();
                if (messaging) {
                    onMessage(messaging, (payload) => {
                        console.log('[App] Foreground Message received:', payload);
                        const title = payload.data?.title || payload.notification?.title || '새 알림';
                        const body = payload.data?.body || payload.notification?.body || '';
                        const targetLink = payload.data?.link || '/notifications';
                        const iconUrl = "/icons/icon-192.png";

                        // [1] 스마트폰 OS 상단 알림바에 시스템 푸시 강제 표출 (진동/소리 + 헤드업 배너)
                        if ('serviceWorker' in navigator && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                            navigator.serviceWorker.ready.then((registration) => {
                                registration.showNotification(title, {
                                    body,
                                    icon: iconUrl,
                                    badge: iconUrl,
                                    data: { link: targetLink },
                                    tag: payload.data?.related_id || 'raoni-foreground-push'
                                } as any);
                            }).catch((err) => {
                                console.warn('[App] Foreground showNotification error:', err);
                            });
                        }

                        // [2] 앱 화면 내 프리미엄 토스트 동시 표출 (인지 극대화)
                        toast(title, {
                            description: body,
                            icon: (
                                <img 
                                    src={iconUrl} 
                                    alt="RAON.I" 
                                    className="w-10 h-10 rounded-full border border-stone-200 object-cover"
                                    style={{ minWidth: '40px', minHeight: '40px' }}
                                />
                            ),
                            action: {
                                label: '보기',
                                onClick: () => {
                                    window.location.href = targetLink;
                                }
                            },
                            duration: 10000,
                        });
                    });
                }
            };
            initForegroundMessage();

            return () => {
                navigator.serviceWorker.removeEventListener('message', handleMessage);
            };
        }
    }, []);

    return null;
}
