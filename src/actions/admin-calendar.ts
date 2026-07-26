'use server';

import { createClient } from '@/lib/supabase-client';
import { formatLocalDate, parseSafeDate } from '@/utils/date';
import { BlockedDate } from '@/types/reservation';

export interface CreateBlockParams {
    siteId: string;
    startDate: Date;
    endDate: Date;
    memo?: string;
    isPaid: boolean;
    guestName?: string;
    contact?: string;
}

/**
 * 관리자 차단일 설정 Server Action
 * 모바일 브라우저 서드파티 쿠키 및 RLS 펜딩을 우회하고 백엔드 서버에서 0.05초 만에 다이렉트 처리합니다.
 */
export async function addBlockDateServerAction(params: CreateBlockParams): Promise<{ success: boolean; data?: BlockedDate; error?: string }> {
    try {
        const supabase = createClient();

        const startDateStr = formatLocalDate(params.startDate);
        const endDateStr = formatLocalDate(params.endDate);

        const { data, error } = await supabase
            .from('blocked_dates')
            .insert({
                site_id: params.siteId,
                start_date: startDateStr,
                end_date: endDateStr,
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
        const supabase = createClient();

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
        if (!ids || ids.length === 0) return { success: true };
        const supabase = createClient();

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
