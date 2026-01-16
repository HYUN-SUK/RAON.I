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
        console.warn('[Firebase] Messaging not supported in this browser');
        return null;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            // VAPID Key가 없으면 경고
            if (!VAPID_KEY) {
                console.error('[Firebase] VAPID Key is missing! Set NEXT_PUBLIC_FIREBASE_VAPID_KEY');
                return null;
            }

            const token = await getToken(messaging, {
                vapidKey: VAPID_KEY
            });
            console.log('[Firebase] FCM Token obtained successfully');
            return token;
        } else {
            console.warn('[Firebase] Notification permission denied');
        }
    } catch (error) {
        console.error('[Firebase] An error occurred while retrieving token:', error);
    }
    return null;
}

export const firebaseSyncToken = async (token: string) => {
    // This is already handled in the hook via database call
    // Logic moved to Hook for Separation of Concerns (Service just provides token)
    return token;
}

export { getMessagingInstance };

