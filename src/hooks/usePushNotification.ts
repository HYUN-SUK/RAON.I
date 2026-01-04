'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';

// SSOT 10.3: Push Strategy
// We use a placeholder for Firebase for now.
// Once firebase config is provided, we will uncomment the imports.

export function usePushNotification() {
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [fcmToken, setFcmToken] = useState<string | null>(null);
    const supabase = createClient();

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setPermission(Notification.permission);
        }
    }, []);

    const requestPermission = async () => {
        if (typeof window === 'undefined') return;

        try {
            const result = await Notification.requestPermission();
            setPermission(result);
            if (result === 'granted') {
                // TODO: Get Token from Firebase
                // const token = await getToken(messaging, { vapidKey: 'YOUR_VAPID_KEY' });
                // setFcmToken(token);
                // syncToken(token);
                console.log('Notification permission granted.');
            }
        } catch (error) {
            console.error('Permission request failed', error);
        }
    };

    const syncToken = async (token: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // DB: push_tokens
        await supabase.from('push_tokens').upsert({
            token,
            user_id: user.id,
            device_type: 'web',
            is_active: true,
            last_updated_at: new Date().toISOString()
        });
    };

    return {
        permission,
        fcmToken,
        requestPermission
    };
}
