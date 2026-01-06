// public/firebase-messaging-sw.js
// Firebase Cloud Messaging Service Worker

// Firebase 설정 (실제 프로젝트 설정)
const firebaseConfig = {
  apiKey: "AIzaSyA90jRL_O7EKQi3dZ4nC3of5dPGwADMni4",
  authDomain: "raon-i-push.firebaseapp.com",
  projectId: "raon-i-push",
  storageBucket: "raon-i-push.firebasestorage.app",
  messagingSenderId: "202794116394",
  appId: "1:202794116394:web:b76f61e403cd35d0332a53"
};

// Firebase SDK import 및 초기화
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 백그라운드 메시지 수신 핸들러
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const notificationTitle = payload.notification?.title || 'RAON.I 알림';
  const notificationOptions = {
    body: payload.notification?.body || '새로운 알림이 도착했습니다.',
    icon: '/images/logo.png',
    badge: '/images/logo.png',
    data: payload.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 서비스 워커 설치 이벤트
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Firebase SW Installed');
  self.skipWaiting();
});

// 서비스 워커 활성화 이벤트
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Firebase SW Activated');
  event.waitUntil(clients.claim());
});

// 알림 클릭 이벤트 핸들러
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked');
  event.notification.close();

  // 앱으로 이동
  const urlToOpen = event.notification.data?.link || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // 이미 열린 창이 있으면 포커스
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // 없으면 새 창 열기
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// 레거시 푸시 이벤트 (FCM 없이 직접 푸시 테스트용)
self.addEventListener('push', function (event) {
  // FCM이 아닌 직접 푸시의 경우 처리
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.notification?.title || 'RAON.I 알림';
    const options = {
      body: payload.notification?.body || event.data.text(),
      icon: '/images/logo.png',
      badge: '/images/logo.png',
      data: payload.data || {}
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    // JSON 파싱 실패 시 텍스트로 처리
    const title = 'RAON.I 알림';
    const options = {
      body: event.data.text(),
      icon: '/images/logo.png',
      badge: '/images/logo.png'
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

