'use server';

import { createAdminClient } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';
import { NotificationEventType } from '@/types/notificationEvents';
import { notificationService } from '@/services/notificationService';
import { ensureScheduleFromReservationAdmin } from './schedule';
import { SITES } from '@/constants/sites';

/**
 * 예약 상태 변경 및 후속 처리 (확정/취소 등)
 */
export async function updateReservationStatusAction(
    id: string,
    status: string,
    cancelReason?: string
) {
    const supabase = createAdminClient();

    // 1. 상태 업데이트
    const updateData: any = {
        status,
        updated_at: new Date().toISOString()
    };

    if (status === 'CANCELLED' && cancelReason) {
        updateData.cancel_reason = cancelReason;
        updateData.cancelled_at = new Date().toISOString();
    }

    const { data: reservation, error } = await (supabase
        .from('reservations') as any)
        .update(updateData)
        .eq('id', id)
        .select('id, user_id, site_id, check_in_date, check_out_date, total_price')
        .single();

    if (error || !reservation) {
        console.error('[Action] Failed to update reservation status:', error);
        return { success: false, error: error?.message || 'Update failed' };
    }

    // 2. [중요] 'CONFIRMED' 시 일정 동기화 강제 실행
    if (status === 'CONFIRMED') {
        console.log(`[Action] Confirmation detected for ${id}. Syncing schedule...`);
        const syncResult = await ensureScheduleFromReservationAdmin(reservation.id, reservation.user_id);
        if (!syncResult.success) {
            console.warn('[Action] Schedule sync failed during confirmation:', syncResult.error);
        }
    }

    // 3. 알림 발송 (Admin Client 사용하여 신뢰도 확보)
    try {
        notificationService.setAdminClient(supabase);

        const siteName = SITES.find(s => s.id === reservation.site_id)?.name || reservation.site_id;

        const payload = {
            siteName,
            checkIn: new Date(reservation.check_in_date).toLocaleDateString(),
            checkOut: new Date(reservation.check_out_date).toLocaleDateString(),
            totalPrice: reservation.total_price?.toLocaleString() || '0',
            reason: cancelReason || (status === 'CONFIRMED' ? '입금 확인' : '관리자 예약 상태 변경')
        };

        const eventType = status === 'CONFIRMED'
            ? NotificationEventType.RESERVATION_CONFIRMED
            : status === 'CANCELLED'
                ? NotificationEventType.RESERVATION_CANCELLED
                : null;

        if (eventType) {
            console.log(`[Action] Dispatching notification for ${id} (Type: ${eventType})`);
            const pushResult = await notificationService.dispatchNotification(
                eventType,
                reservation.user_id,
                payload,
                id
            );
            console.log(`[Action] Notification result:`, pushResult);
        }
    } catch (notifErr) {
        console.error('[Action] Notification dispatch internal error:', notifErr);
    }

    // 4. 경로 무효화
    revalidatePath('/admin/reservations');
    revalidatePath('/myspace/schedule');
    revalidatePath('/notifications');

    return { success: true };
}
