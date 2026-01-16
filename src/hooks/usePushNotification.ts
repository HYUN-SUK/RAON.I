'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';

// This will be replaced by lib/firebase usage
import { firebaseRequestPermission, firebaseSyncToken } from '@/lib/firebase';
import { toast } from 'sonner';

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
                toast.success('알림 설정이 완료되었습니다!');
            } else {
                if (Notification.permission === 'denied') {
                    toast.error('알림 권한이 차단되어 있습니다. 브라우저 설정에서 허용해주세요.');
                }
            }
        } catch (error) {
            console.error('Permission request failed', error);
            toast.error('알림 설정 중 오류가 발생했습니다.');
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
