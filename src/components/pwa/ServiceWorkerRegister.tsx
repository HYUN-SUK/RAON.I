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
                    await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                } catch (err) {
                    console.log('Service Worker registration failed:', err);
                }
            };
            registerSW();

            // 2. Message Listener (Service Worker -> Client, e.g. Deep Link Fallback)
            // CRITICAL: This handles navigation requests from the SW when the app is open.
            // DO NOT REMOVE THIS even if foreground toasts are disabled.
            const handleMessage = (event: MessageEvent) => {
                if (event.data && event.data.type === 'NOTIFICATION_CLICK' && event.data.url) {
                    window.location.href = event.data.url;
                }
            };
            navigator.serviceWorker.addEventListener('message', handleMessage);

            // 3. Foreground Message Listener (Firebase SDK) - DISABLED by User Request 
            // The user requested to hide "New Alarms" (toasts) when the app is open.
            // Since we kept the listener above (#2), clicking a SYSTEM notification will still work.
            /*
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
            */

            return () => {
                navigator.serviceWorker.removeEventListener('message', handleMessage);
            };
        }
    }, []);

    return null;
}
