'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase-client';

// This will be replaced by lib/firebase usage
import { firebaseRequestPermission, firebaseSyncToken } from '@/lib/firebase';
import { toast } from 'sonner';

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
                    await supabase.from('push_tokens').upsert({
                        token,
                        user_id: user.id,
                        device_type: 'web',
                        is_active: true,
                        last_updated_at: new Date().toISOString()
                    });
                }

                toast.success('알림 설정이 완료되었습니다!');
            } else {
                if (Notification.permission === 'denied') {
                    toast.error('알림 권한이 차단되어 있습니다. 브라우저 설정에서 허용해주세요.');
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
