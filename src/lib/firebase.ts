import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

// SSOT 10.3: Web Push Strategy
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Messaging is only supported in browser & https
let messaging: any = null;
if (typeof window !== 'undefined') {
    isSupported().then(supported => {
        if (supported) {
            messaging = getMessaging(app);
        }
    });
}

export const firebaseRequestPermission = async (): Promise<string | null> => {
    if (!messaging) return null;
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const token = await getToken(messaging);
            return token;
        }
    } catch (error) {
        console.error('An error occurred while retrieving token. ', error);
    }
    return null;
}

export const firebaseSyncToken = async (token: string) => {
    // This is already handled in the hook via database call
    // Logic moved to Hook for Separation of Concerns (Service just provides token)
    return token;
}

export { messaging };
