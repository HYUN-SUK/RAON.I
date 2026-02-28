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
                    // [1-1] Hard Reset: Unregister ALL existing workers to clear query-param collisions
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (let registration of registrations) {
                        await registration.unregister();
                        console.log('[SW] Existing worker unregistered');
                    }

                    // [1-2] Clean Registration
                    await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                    console.log('[SW] Clean worker registered');
                } catch (err) {
                    console.log('Service Worker registration failed:', err);
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
                        const { title, body } = payload.notification || {};

                        // Show Toast
                        toast.info(title || '새 알림', {
                            description: body,
                            action: {
                                label: '보기',
                                onClick: () => {
                                    window.location.href = '/notifications';
                                }
                            },
                            duration: Infinity,
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
