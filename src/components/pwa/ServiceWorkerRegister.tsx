"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export default function ServiceWorkerRegister() {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            // Register the firebase-messaging-sw.js as the main service worker
            const registerSW = async () => {
                try {
                    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                    console.log('Service Worker registered with scope:', registration.scope);
                } catch (err) {
                    console.log('Service Worker registration failed:', err);
                }
            };
            registerSW();

            // Listen for messages from SW (e.g. Deep Linking)
            const handleMessage = (event: MessageEvent) => {
                if (event.data && event.data.type === 'NOTIFICATION_CLICK' && event.data.url) {
                    console.log('[App] Received navigation request:', event.data.url);
                    toast(`이동 요청 수신: ${event.data.url}`, { duration: 3000 }); // Debug Toast
                    window.location.href = event.data.url; // Force navigation
                }
            };

            navigator.serviceWorker.addEventListener('message', handleMessage);
            toast('알림 리스너 대기중', { duration: 2000, id: 'sw-listener' }); // Debug Toast

            return () => {
                navigator.serviceWorker.removeEventListener('message', handleMessage);
            };
        }
    }, []);

    return null;
}
