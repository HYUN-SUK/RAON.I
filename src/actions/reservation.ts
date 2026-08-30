'use server';

import { createAdminClient } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';
import { NotificationEventType } from '@/types/notificationEvents';
import { notificationService } from '@/services/notificationService';
import { ensureScheduleFromReservationAdmin } from './schedule';
import { SITES } from '@/constants/sites';
import { assertAdmin, checkIsAdmin, getCurrentUser } from '@/lib/auth-guard';
import { formatLocalDate } from '@/utils/date';

/**
 * 예약 상태 변경 및 후속 처리 (확정/취소 등)
 * - CONFIRMED: 관리자만 실행 가능
 * - CANCELLED: 관리자, 예약 당사자 본인(user_id), 또는 시스템 크론잡만 실행 가능
 * - 기타: 관리자만 실행 가능
 */
export async function updateReservationStatusAction(
    id: string,
    status: string,
    cancelReason?: string
) {
    const supabase = createAdminClient();

    // 0. 현재 대상 예약 확인
    const { data: currentRes, error: fetchErr } = await (supabase
        .from('reservations') as any)
        .select('id, user_id, status')
        .eq('id', id)
        .single();

    if (fetchErr || !currentRes) {
        return { success: false, error: '해당 예약을 찾을 수 없습니다.' };
    }

    if (currentRes.status === status) {
        console.log(`[Action] Status for ${id} is already ${status}. Skipping.`);
        return { success: true, message: 'Already in target status' };
    }

    // 0-1. 호출자 권한 정밀 검증
    const currentUser = await getCurrentUser();
    const isAdmin = await checkIsAdmin();

    if (status === 'CONFIRMED') {
        if (!isAdmin) {
            throw new Error('403 Forbidden: 관리자만 예약을 확정할 수 있습니다.');
        }
    } else if (status === 'CANCELLED') {
        const isOwner = currentUser && currentRes.user_id === currentUser.id;
        // 크론잡이나 시스템 호출(currentUser가 null이지만 서버 환경) 또는 관리자 또는 본인
        if (!isAdmin && !isOwner && currentUser !== null) {
            throw new Error('403 Forbidden: 본인의 예약만 취소할 수 있습니다.');
        }
    } else {
        if (!isAdmin) {
            throw new Error('403 Forbidden: 관리자 권한이 필요합니다.');
        }
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

    // 3. 백그라운드 비동기 후속 작업 (FCM 푸시, 대기자 알림, 일정 취소 동기화)
    // Edge Functions 및 구글 FCM 외부 통신으로 인한 관리자 화면 멈춤을 원천 차단하기 위해 백그라운드로 안전하게 격리 실행
    (async () => {
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
                console.log(`[Action/Background] Dispatching notification for ${id} (Type: ${eventType})`);
                await notificationService.dispatchNotification(
                    eventType,
                    reservation.user_id,
                    payload,
                    id
                );

                // [v11.9.75] 예약 취소(CANCELLED) 처리 성공 시, 빈자리 대기자들에게 자동으로 알림 발송
                if (status === 'CANCELLED') {
                    try {
                        const { notifyWaitlistUsers } = await import('@/actions/waitlist-notifier');
                        // DB에서 읽어온 reservation.check_in_date는 'YYYY-MM-DD' 문자열이므로 타임존 밀림 없이 100% 안전
                        await notifyWaitlistUsers(reservation.check_in_date, reservation.site_id);
                    } catch (waitlistErr) {
                        console.error('[Action/Background] Waitlist notify trigger failed:', waitlistErr);
                    }

                    // [v11.9.108] 예약 취소 시 연동된 일정 상태도 함께 취소('cancelled') 상태로 업데이트
                    try {
                        const { cancelScheduleByReservation } = await import('./schedule');
                        await cancelScheduleByReservation(id);
                    } catch (schedErr) {
                        console.error('[Action/Background] Cancel schedule trigger failed:', schedErr);
                    }
                }
            }
        } catch (notifErr) {
            console.error('[Action/Background] Notification dispatch internal error:', notifErr);
        }
    })();

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
    updates: { checkInDate: Date | string; checkOutDate: Date | string; siteId: string; totalPrice: number }
) {
    await assertAdmin();
    const supabase = createAdminClient();

    // 순수 날짜 문자열 (YYYY-MM-DD) 추출
    const checkInStr = typeof updates.checkInDate === 'string' && updates.checkInDate.includes('-')
        ? updates.checkInDate.split('T')[0]
        : formatLocalDate(updates.checkInDate);
    const checkOutStr = typeof updates.checkOutDate === 'string' && updates.checkOutDate.includes('-')
        ? updates.checkOutDate.split('T')[0]
        : formatLocalDate(updates.checkOutDate);

    // 0-1. 서버 2차 가드: DB blocked_dates 차단 여부 확인 (start_date < checkOutStr && end_date >= checkInStr)
    const { data: blockedList } = await (supabase
        .from('blocked_dates') as any)
        .select('id, start_date, end_date')
        .eq('site_id', updates.siteId)
        .lt('start_date', checkOutStr)
        .gte('end_date', checkInStr);

    if (blockedList && blockedList.length > 0) {
        throw new Error('선택하신 사이트는 해당 기간에 관리자 차단(Blocked)이 설정되어 있어 변경할 수 없습니다.');
    }

    // 0-2. 서버 2차 가드: DB reservations 중복 예약 확인 (PENDING, CONFIRMED 상태만 차단)
    const { data: overlapList } = await (supabase
        .from('reservations') as any)
        .select('id, status')
        .neq('id', id)
        .eq('site_id', updates.siteId)
        .in('status', ['PENDING', 'CONFIRMED'])
        .lt('check_in_date', checkOutStr)
        .gt('check_out_date', checkInStr);

    if (overlapList && overlapList.length > 0) {
        throw new Error('선택하신 사이트는 해당 기간에 이미 다른 예약(신청/완료) 건이 존재하여 변경할 수 없습니다.');
    }

    // 1. reservations 테이블 업데이트
    const { error: resError } = await (supabase
        .from('reservations') as any)
        .update({
            check_in_date: checkInStr,
            check_out_date: checkOutStr,
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
            check_in: checkInStr,
            check_out: checkOutStr,
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

/**
 * 사용자 예약 취소 요청 (환불 정보 및 취소 사유 저장) [v13.9.0]
 */
export async function requestReservationCancelAction(params: {
    reservationId: string;
    refundBank: string;
    refundAccount: string;
    refundHolder: string;
    cancelReason?: string;
}): Promise<{
    success: boolean;
    refundRate?: number;
    refundAmount?: number;
    error?: string;
    message?: string;
}> {
    const supabase = createAdminClient();
    const currentUser = await getCurrentUser();

    // 1. 대상 예약 조회
    const { data: reservation, error: fetchErr } = await (supabase
        .from('reservations') as any)
        .select('id, user_id, status, check_in_date, total_price, site_id')
        .eq('id', params.reservationId)
        .single();

    if (fetchErr || !reservation) {
        return { success: false, error: 'NOT_FOUND', message: '예약을 찾을 수 없습니다.' };
    }

    // 2. 권한 확인 (본인 또는 관리자)
    const isAdmin = await checkIsAdmin();
    if (!isAdmin && (!currentUser || currentUser.id !== reservation.user_id)) {
        return { success: false, error: 'UNAUTHORIZED', message: '본인의 예약만 취소 요청할 수 있습니다.' };
    }

    if (!['PENDING', 'CONFIRMED'].includes(reservation.status)) {
        return { success: false, error: 'INVALID_STATUS', message: '취소할 수 없는 예약 상태입니다.' };
    }

    // 3. 환불율 및 환불금액 계산
    const { calculateRefundRate, calculateRefundAmount } = await import('@/constants/refund');
    const checkInDate = new Date(reservation.check_in_date);
    const refundRate = calculateRefundRate(checkInDate);
    const refundAmount = calculateRefundAmount(reservation.total_price || 0, checkInDate);

    // 4. reservations 테이블 업데이트
    const { error: updateErr } = await (supabase
        .from('reservations') as any)
        .update({
            status: 'REFUND_PENDING',
            refund_bank: params.refundBank,
            refund_account: params.refundAccount,
            refund_holder: params.refundHolder,
            cancel_reason: params.cancelReason || null,
            refund_rate: refundRate,
            refund_amount: refundAmount,
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', params.reservationId);

    if (updateErr) {
        console.error('[requestReservationCancelAction] Update failed:', updateErr);
        return { success: false, error: 'DB_ERROR', message: updateErr.message };
    }

    // 5. 빈자리 대기자 알림 발송
    try {
        const { notifyWaitlistUsers } = await import('@/actions/waitlist-notifier');
        await notifyWaitlistUsers(reservation.check_in_date, reservation.site_id);
    } catch (e) {
        console.error('[requestReservationCancelAction] Waitlist notify error:', e);
    }

    // 6. 캐시 무효화
    revalidatePath('/admin/reservations');
    revalidatePath('/admin/payments');
    revalidatePath('/myspace/reservations');

    return {
        success: true,
        refundRate,
        refundAmount,
        message: '취소 요청이 완료되었습니다. 환불은 관리자 확인 후 처리됩니다.'
    };
}
