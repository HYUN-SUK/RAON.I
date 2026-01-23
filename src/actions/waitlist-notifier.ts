'use server';

/**
 * 빈자리 알림 발송 유틸리티
 * 예약 취소 또는 차단 해제 시 대기자에게 알림 발송
 */

import { createClient } from '@supabase/supabase-js';
import { notificationService } from '@/services/notificationService';
import { NotificationEventType } from '@/types/notificationEvents';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// Service Role 클라이언트 (RLS 우회용)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface WaitlistUser {
    user_id: string;
    target_date: string;
    site_id: string | null;
}

/**
 * 특정 날짜에 빈자리가 생겼을 때 대기자들에게 알림 발송
 * @param targetDate - 빈자리가 생긴 날짜 (YYYY-MM-DD)
 * @param siteId - 특정 사이트 ID (없으면 전체)
 */
export async function notifyWaitlistUsers(targetDate: string, siteId?: string): Promise<{
    success: boolean;
    notifiedCount: number;
    message?: string;
}> {
    try {
        // 1. 대기자 조회 (RPC 사용)
        const { data: waitlistUsers, error: fetchError } = await supabaseAdmin
            .rpc('get_waitlist_users', {
                p_date: targetDate,
                p_site_id: siteId || null
            });

        if (fetchError) {
            console.error('[WaitlistNotifier] RPC error:', fetchError);
            return { success: false, notifiedCount: 0, message: fetchError.message };
        }

        if (!waitlistUsers || waitlistUsers.length === 0) {
            return { success: true, notifiedCount: 0, message: 'No waitlist users found' };
        }

        // 2. 각 대기자에게 알림 발송
        const formattedDate = format(new Date(targetDate), 'M월 d일', { locale: ko });
        let notifiedCount = 0;

        for (const user of waitlistUsers as WaitlistUser[]) {
            try {
                // 푸시 알림 발송
                await notificationService.dispatchNotification(
                    NotificationEventType.WAITLIST_SLOT_OPENED,
                    user.user_id,
                    { targetDate: formattedDate },
                    targetDate // relatedId로 날짜 저장
                );

                // 알림 완료 처리
                await supabaseAdmin.rpc('mark_waitlist_notified', {
                    p_user_id: user.user_id,
                    p_date: targetDate,
                    p_site_id: user.site_id || null
                });

                notifiedCount++;
            } catch (err) {
                console.error(`[WaitlistNotifier] Failed to notify user ${user.user_id}:`, err);
                // 개별 실패는 무시하고 계속 진행
            }
        }

        console.log(`[WaitlistNotifier] Notified ${notifiedCount}/${waitlistUsers.length} users for ${targetDate}`);
        return { success: true, notifiedCount };

    } catch (err) {
        console.error('[WaitlistNotifier] Exception:', err);
        return { success: false, notifiedCount: 0, message: 'Exception occurred' };
    }
}
