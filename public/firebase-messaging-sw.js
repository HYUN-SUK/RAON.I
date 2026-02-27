// public/firebase-messaging-sw.js
// Firebase Cloud Messaging Service Worker

// 1. Firebase Config (Hardcoded for stability)
const firebaseConfig = {
  apiKey: "AIzaSyCXW3gnlflXMvLEy8E4ETNBi3W-J7U6T7A",
  authDomain: "raon-i.firebaseapp.com",
  projectId: "raon-i-push",
  storageBucket: "raon-i.appspot.com",
  messagingSenderId: "367175222047",
  appId: "1:367175222047:web:86eeb9b79878207908c69c"
};

// 2. Firebase SDK import 및 초기화
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 배경 메시지 처리는 Firebase SDK에 위임하여 브라우저 기본 기능(2일 전 상태)으로 작동하게 함
// (messaging.onBackgroundMessage 핸들러를 제거하여 SDK가 notification 필드를 읽어 직접 팝업하게 함)

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
