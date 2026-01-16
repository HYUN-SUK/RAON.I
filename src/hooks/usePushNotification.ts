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
        console.log('[PushHook] Syncing token to DB...');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.warn('[PushHook] No user logged in, cannot sync token');
            return;
        }

        console.log('[PushHook] User ID:', user.id);
        // DB: push_tokens
        const { error } = await supabase.from('push_tokens').upsert({
            token,
            user_id: user.id,
            device_type: 'web',
            is_active: true,
            last_updated_at: new Date().toISOString()
        });

        if (error) {
            console.error('[PushHook] Token sync failed:', error);
        } else {
            console.log('[PushHook] Token synced successfully!');
        }
    };

    return {
        permission,
        fcmToken,
        requestPermission
    };
}
