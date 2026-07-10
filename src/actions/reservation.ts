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

    // 0. 현재 상태 확인 (중복 처리 방지)
    const { data: currentRes } = await supabase
        .from('reservations')
        .select('status')
        .eq('id', id)
        .single();

    if ((currentRes as any)?.status === status) {
        console.log(`[Action] Status for ${id} is already ${status}. Skipping.`);
        return { success: true, message: 'Already in target status' };
    }

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

/**
 * 예약 상세 정보 수정 및 연동 사용자 일정 동기화 (관리자 전용)
 */
export async function updateReservationAction(
    id: string,
    updates: { checkInDate: Date; checkOutDate: Date; siteId: string; totalPrice: number }
) {
    const supabase = createAdminClient();

    // 1. reservations 테이블 업데이트
    const { error: resError } = await (supabase
        .from('reservations') as any)
        .update({
            check_in_date: updates.checkInDate.toISOString().split('T')[0],
            check_out_date: updates.checkOutDate.toISOString().split('T')[0],
            site_id: updates.siteId,
            total_price: updates.totalPrice,
            updated_at: new Date().toISOString()
        })
        .eq('id', id);

    if (resError) {
        console.error('[Action] Failed to update reservation in DB:', resError);
        throw new Error(resError.message);
    }

    // 2. user_schedules 테이블 연동 동기화 + 스마트플랜 리셋
    const { error: schedError } = await (supabase
        .from('user_schedules') as any)
        .update({
            check_in: updates.checkInDate.toISOString().split('T')[0],
            check_out: updates.checkOutDate.toISOString().split('T')[0],
            smart_plan_data: null, // 날짜 변경으로 인한 기존 스마트플랜 캐시 리셋
            updated_at: new Date().toISOString()
        })
        .eq('reservation_id', id);

    if (schedError) {
        console.warn('[Action] user_schedules update failed or record not found:', schedError.message);
    }

    // 3. 경로 캐시 무효화
    revalidatePath('/admin/reservations');
    revalidatePath('/myspace/schedule');
    
    return { success: true };
}
