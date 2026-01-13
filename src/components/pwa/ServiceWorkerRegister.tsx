"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            // Register the firebase-messaging-sw.js as the main service worker
            // This satisfies PWA install criteria (req. registered Service Worker)
            navigator.serviceWorker.register('/firebase-messaging-sw.js')
                .then((registration) => {
                    console.log('Service Worker registered with scope:', registration.scope);
                })
                .catch((err) => {
                    console.log('Service Worker registration failed:', err);
                });
        }
    }, []);

    return null;
}
