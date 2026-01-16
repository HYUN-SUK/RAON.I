'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';

// This will be replaced by lib/firebase usage
import { firebaseRequestPermission, firebaseSyncToken } from '@/lib/firebase';

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
            const token = await firebaseRequestPermission();
            setPermission(Notification.permission);
            if (token) {
                setFcmToken(token);
                // Sync to DB
                await syncToken(token);
            }
        } catch (error) {
            console.error('Permission request failed', error);
        }
    };

    const syncToken = async (token: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

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
