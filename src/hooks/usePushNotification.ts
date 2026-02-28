'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase-client';

// This will be replaced by lib/firebase usage
import { firebaseRequestPermission, firebaseSyncToken } from '@/lib/firebase';
// import { toast } from 'sonner'; // Toast removed for silence

export function usePushNotification() {
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [fcmToken, setFcmToken] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setPermission(Notification.permission);
        }
    }, []);

    const requestPermission = useCallback(async () => {
        if (typeof window === 'undefined') return;

        try {
            const token = await firebaseRequestPermission();
            setPermission(Notification.permission);

            if (token) {
                setFcmToken(token);

                // Internal Sync Logic (Stable)
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();

                if (user) {
                    // [SYNC GUARD] Prevent redundant writes if token hasn't changed
                    const lastToken = localStorage.getItem('last_synced_fcm_token');
                    if (lastToken === token) {
                        console.log('[Push] Token already synced. Skipping...');
                    } else {
                        await supabase.from('push_tokens').upsert({
                            token,
                            user_id: user.id,
                            device_type: 'web',
                            is_active: true,
                            last_updated_at: new Date().toISOString()
                        });
                        localStorage.setItem('last_synced_fcm_token', token);
                        console.log('[Push] Token synced to Supabase');
                    }
                }

                // Silent success (User requested to hide toast on every visit)
                // toast.success('알림 설정이 완료되었습니다!');
            } else {
                if (Notification.permission === 'denied') {
                    // toast.error('알림 권한이 차단되어 있습니다. 브라우저 설정에서 허용해주세요.');
                    console.warn('Notification permission denied');
                }
            }
        } catch (error: any) {
            console.error('Permission request failed', error);
        }
    }, []); // Zero dependencies = Guaranteed Stability

    return {
        permission,
        fcmToken,
        requestPermission
    };
}
