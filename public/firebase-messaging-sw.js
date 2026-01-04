// public/firebase-messaging-sw.js
// Firebase Cloud Messaging Service Worker

// TODO: User must replace this with their own config later.
// TODO: [중요] 아래 firebaseConfig 값을 선생님이 발급받은 실제 값으로 직접 수정해주셔야 합니다.
// (이 파일은 빌드 과정 밖에 있어서 process.env를 쓸 수 없습니다)
const firebaseConfig = {
  apiKey: "AIzaSyA90jRL_O7EKQi3dZ4nC3of5dPGwADMni4",
  authDomain: "raon-i-push.firebaseapp.com",
  projectId: "raon-i-push",
  storageBucket: "raon-i-push.firebasestorage.app",
  messagingSenderId: "202794116394",
  appId: "1:202794116394:web:b76f61e403cd35d0332a53"
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
