'use server';

import { createAdminClient } from '@/lib/supabase-admin';
import { parseSafeDate } from '@/utils/date';
import { BlockedDate } from '@/types/reservation';
import { assertAdmin } from '@/lib/auth-guard';

export interface CreateBlockParams {
    siteId: string;
    startDateStr: string; // YYYY-MM-DD
    endDateStr: string;   // YYYY-MM-DD
    memo?: string;
    isPaid: boolean;
    guestName?: string;
    contact?: string;
}

/**
 * 관리자 차단일 설정 Server Action
 * YYYY-MM-DD 순수 문자열 기반 적재로 UTC-KST 타임존 날짜 밀림 현상을 원천 방지합니다.
 */
export async function addBlockDateServerAction(params: CreateBlockParams): Promise<{ success: boolean; data?: BlockedDate; error?: string }> {
    try {
        await assertAdmin();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabase = createAdminClient() as any;

        const { data, error } = await supabase
            .from('blocked_dates')
            .insert({
                site_id: params.siteId,
                start_date: params.startDateStr,
                end_date: params.endDateStr,
                memo: params.memo || null,
                is_paid: params.isPaid,
                guest_name: params.guestName || null,
                contact: params.contact || null
            })
            .select()
            .single();

        if (error) {
            console.error('[admin-calendar] addBlockDateServerAction error:', error);
            return { success: false, error: error.message || '차단 등록 중 DB 오류가 발생했습니다.' };
        }

        if (!data) {
            return { success: false, error: '차단 등록 결과 데이터를 받지 못했습니다.' };
        }

        const newBlock: BlockedDate = {
            id: data.id,
            siteId: data.site_id,
            startDate: parseSafeDate(data.start_date),
            endDate: parseSafeDate(data.end_date),
            memo: data.memo || undefined,
            isPaid: data.is_paid,
            guestName: data.guest_name || undefined,
            contact: data.contact || undefined
        };

        return { success: true, data: newBlock };
    } catch (err: any) {
        console.error('[admin-calendar] addBlockDateServerAction Exception:', err);
        return { success: false, error: err?.message || '서버 처리 중 예외가 발생했습니다.' };
    }
}

/**
 * 관리자 차단일 단일 해제/삭제 Server Action
 */
export async function removeBlockDateServerAction(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        await assertAdmin();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabase = createAdminClient() as any;

        // 1. 기존 차단 내역 조회 (빈자리 알림용)
        const { data: targetBlock } = await supabase
            .from('blocked_dates')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        // 2. 차단 삭제
        const { error } = await supabase
            .from('blocked_dates')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('[admin-calendar] removeBlockDateServerAction error:', error);
            return { success: false, error: error.message || '차단 해제 삭제 실패' };
        }

        // 3. 빈자리 알림 발송 (비동기)
        if (targetBlock) {
            try {
                const { notifyWaitlistUsers } = await import('@/actions/waitlist-notifier');
                await notifyWaitlistUsers(targetBlock.start_date, targetBlock.site_id);
            } catch (notifyErr) {
                console.error('[admin-calendar] Waitlist notify failed:', notifyErr);
            }
        }

        return { success: true };
    } catch (err: any) {
        console.error('[admin-calendar] removeBlockDateServerAction Exception:', err);
        return { success: false, error: err?.message || '삭제 중 예외가 발생했습니다.' };
    }
}

/**
 * 관리자 일괄 차단 해제 Server Action
 */
export async function unblockAllServerAction(ids: string[]): Promise<{ success: boolean; error?: string }> {
    try {
        await assertAdmin();
        if (!ids || ids.length === 0) return { success: true };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabase = createAdminClient() as any;

        const { error } = await supabase
            .from('blocked_dates')
            .delete()
            .in('id', ids);

        if (error) {
            console.error('[admin-calendar] unblockAllServerAction error:', error);
            return { success: false, error: error.message || '일괄 차단 해제 실패' };
        }

        return { success: true };
    } catch (err: any) {
        console.error('[admin-calendar] unblockAllServerAction Exception:', err);
        return { success: false, error: err?.message || '일괄 삭제 중 예외 발생' };
    }
}

/**
 * 관리자 캘린더 전용 고속 원본 데이터 조회 Server Action
 * 모바일/PC 캐시 불일치를 원천 차단하고 최신 DB 원본을 즉시 반환합니다.
 */
export async function fetchAdminCalendarDataServerAction(): Promise<{
    success: boolean;
    reservations: any[];
    blockedDates: BlockedDate[];
    error?: string;
}> {
    try {
        await assertAdmin();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabase = createAdminClient() as any;

        // 1. reservations 조회
        const { data: resData, error: resErr } = await supabase
            .from('reservations')
            .select('*')
            .order('created_at', { ascending: false });

        if (resErr) {
            console.error('[fetchAdminCalendarDataServerAction] resErr:', resErr);
        }

        // 2. blocked_dates 조회
        const { data: blockData, error: blockErr } = await supabase
            .from('blocked_dates')
            .select('*');

        if (blockErr) {
            console.error('[fetchAdminCalendarDataServerAction] blockErr:', blockErr);
        }

        const mappedBlocks: BlockedDate[] = (blockData || []).map((d: any) => ({
            id: d.id,
            siteId: d.site_id,
            startDate: parseSafeDate(d.start_date),
            endDate: parseSafeDate(d.end_date),
            memo: d.memo || undefined,
            isPaid: d.is_paid,
            guestName: d.guest_name || undefined,
            contact: d.contact || undefined
        }));

        return {
            success: true,
            reservations: resData || [],
            blockedDates: mappedBlocks
        };
    } catch (err: any) {
        console.error('[fetchAdminCalendarDataServerAction] Exception:', err);
        return {
            success: false,
            reservations: [],
            blockedDates: [],
            error: err?.message || '캘린더 데이터 로드 실패'
        };
    }
}

