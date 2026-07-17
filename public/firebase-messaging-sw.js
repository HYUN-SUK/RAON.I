// public/firebase-messaging-sw.js
// Version: 2.1 (Force Update)
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

// 3. 백그라운드 메시지 수신 핸들러
// [CRITICAL FIX] FCM SDK가 webpush.notification 객체를 수신해 백그라운드에서 자동으로 시스템 알림을 표시하므로,
// onBackgroundMessage 내부에서 showNotification을 명시적으로 실행하면 2중 팝업이 뜹니다.
// 이 리스너는 수신 로그 출력 및 디버깅용으로만 제한하고 수동으로 알림은 띄우지 않습니다.
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background Message Received:', payload);
  // (수동 showNotification 제거 완료 - FCM SDK 자동 팝업에 전적으로 위임)
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
