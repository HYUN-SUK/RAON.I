// public/firebase-messaging-sw.js
// Firebase Cloud Messaging Service Worker

// 쿼리스트링 파싱 유틸리티 함수
const qs = new URLSearchParams(self.location.search);

// 1. URL 파라미터에서 환경변수 로딩 (동적 주입 - 하드코딩 제거)
const firebaseConfig = {
  apiKey: qs.get('apiKey'),
  authDomain: qs.get('authDomain'),
  projectId: qs.get('projectId'),
  storageBucket: qs.get('storageBucket'),
  messagingSenderId: qs.get('messagingSenderId'),
  appId: qs.get('appId')
};

// 필수 값이 없다면 Firebase SDK 초기화 중지
if (!firebaseConfig.apiKey) {
  console.error('[Service Worker] Missing Firebase config parameters. SDK will not initialize.');
} else {
  // 2. Firebase SDK import 및 초기화 (최상단)
  importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
  importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // 백그라운드 메시지 수신 핸들러 (Firebase SDK 표준 방식)
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    const title = payload.notification?.title || 'RAON.I 알림';
    const options = {
      body: payload.notification?.body || '',
      icon: '/images/logo.png',
      badge: '/images/logo.png', // 단색 아이콘 권장
      data: payload.data || {}
    };

    return self.registration.showNotification(title, options);
  });
}

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
            // Focus first, then SIGNAL the client to navigate (More reliable than client.navigate for PWA)
            return client.focus().then((focusedClient) => {
              const targetUrl = new URL(urlToOpen, self.location.origin).href;

              // 1. Try sending a message to the client (Handled by ServiceWorkerRegister.tsx)
              focusedClient.postMessage({
                type: 'NOTIFICATION_CLICK',
                url: targetUrl
              });

              // 2. Also try redirecting via param as backup (for full reloads)
              const redirectUrl = new URL('/', self.location.origin);
              redirectUrl.searchParams.set('push_redirect', targetUrl);
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

// (수동 푸시 이벤트 핸들러 삭제됨 - Firebase SDK(onBackgroundMessage)에 팝업 처리를 위임하여 충돌 방지)

// PWA Install Criteria: Must have a fetch handler
self.addEventListener('fetch', (event) => {
  // Just a pass-through for now, but required for PWA 'Add to Home Screen'
  return;
});
