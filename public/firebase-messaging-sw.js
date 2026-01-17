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
  let urlToOpen = event.notification.data?.link || '/notifications'; // Default to notifications page
  if (!urlToOpen || urlToOpen === '/') {
    urlToOpen = '/notifications';
  }
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // 1. Check if there is an existing window we can focus
        for (const client of windowClients) {
          // Check if client is under same origin
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Focus first, then navigate via text query param (most robust)
            return client.focus().then((focusedClient) => {
              const targetUrl = new URL(urlToOpen, self.location.origin).href;
              // Construct redirect URL: /?push_redirect=TARGET_URL
              const redirectUrl = new URL('/', self.location.origin);
              redirectUrl.searchParams.set('push_redirect', targetUrl);

              // Fallback: direct navigation with param
              return focusedClient.navigate(redirectUrl.href);
            });
          }
        }

        // 2. If no window exists, open a new one
        if (clients.openWindow) {
          // Absolute URL is safer
          const absoluteUrl = new URL(urlToOpen, self.location.origin).href;
          return clients.openWindow(absoluteUrl);
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

// PWA Install Criteria: Must have a fetch handler
self.addEventListener('fetch', (event) => {
  // Just a pass-through for now, but required for PWA 'Add to Home Screen'
  return;
});
