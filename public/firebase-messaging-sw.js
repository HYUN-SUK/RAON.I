// public/firebase-messaging-sw.js
// Firebase Cloud Messaging Service Worker

// TODO: User must replace this with their own config later.
// SSOT 10.3: Web Push Strategy
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase (Example code, commented out until config is provided)
/*
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png' // Ensure this icon exists
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
*/

self.addEventListener('install', (event) => {
    console.log('Firebase Service Worker Installed');
    self.skipWaiting();
});

self.addEventListener('push', function (event) {
    console.log('[Service Worker] Push Received.');
    // Fallback for testing without FCM payload
    const title = 'RAON.I 알림';
    const options = {
        body: event.data ? event.data.text() : '새로운 알림이 도착했습니다.',
        icon: '/images/logo.png', // Update with actual logo path
        badge: '/images/logo.png'
    };

    // event.waitUntil(self.registration.showNotification(title, options));
});
