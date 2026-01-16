import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, Messaging } from 'firebase/messaging';

// SSOT 10.3: Web Push Strategy
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// VAPID Key for Web Push (Firebase Console > Cloud Messaging > Web Push certificates)
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Messaging 초기화를 Promise로 관리 (race condition 방지)
let messagingPromise: Promise<Messaging | null> | null = null;

const getMessagingInstance = async (): Promise<Messaging | null> => {
    if (typeof window === 'undefined') return null;

    if (!messagingPromise) {
        messagingPromise = isSupported().then(supported => {
            if (supported) {
                return getMessaging(app);
            }
            return null;
        });
    }

    return messagingPromise;
};

export const firebaseRequestPermission = async (): Promise<string | null> => {
    const messaging = await getMessagingInstance();
    if (!messaging) {
        throw new Error('이 브라우저는 푸시 알림을 지원하지 않습니다.');
    }

    try {
        const permission = await Notification.requestPermission();

        if (permission === 'granted') {
            if (!VAPID_KEY) {
                throw new Error('서버 설정 오류 (VAPID Key Missing)');
            }

            const token = await getToken(messaging, { vapidKey: VAPID_KEY });
            return token;
        } else {
            throw new Error('알림 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.');
        }
    } catch (error: any) {
        // Firebase specific errors
        if (error.code === 'messaging/permission-blocked' || error.message?.includes('permission')) {
            throw new Error('알림 권한이 차단되었습니다.');
        }
        // Rethrow with custom message if needed, or just let it bubble
        throw error;
    }
}

export const firebaseSyncToken = async (token: string) => {
    // This is already handled in the hook via database call
    // Logic moved to Hook for Separation of Concerns (Service just provides token)
    return token;
}

export { getMessagingInstance };

