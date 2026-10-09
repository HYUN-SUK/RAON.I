'use server';

/**
 * 빈자리 알림 Server Actions
 * - 브라우저 RLS 제약을 원천 차단하고 Service Role(Admin)으로 안전하게 처리
 * - 재신청(Upsert) 및 대기 취소, 상태 조회를 100% 보장
 */

import { createAdminClient } from '@/lib/supabase-admin';
import { getCurrentUser } from '@/lib/auth-guard';

/**
 * 특정 날짜/사이트에 대한 본인의 활성 대기 상태 조회
 */
export async function checkWaitlistStatusAction(targetDate: string, siteId?: string): Promise<{
    isRegistered: boolean;
}> {
    try {
        const user = await getCurrentUser();
        if (!user) return { isRegistered: false };

        const admin = createAdminClient();
        let query = (admin.from('waitlist') as any)
            .select('id')
            .eq('user_id', user.id)
            .eq('target_date', targetDate)
            .eq('is_notified', false);

        if (siteId) {
            query = query.eq('site_id', siteId);
        } else {
            query = query.is('site_id', null);
        }

        const { data } = await query.maybeSingle();
        return { isRegistered: !!data };
    } catch (e) {
        console.error('[checkWaitlistStatusAction] Error:', e);
        return { isRegistered: false };
    }
}

/**
 * 빈자리 알림 신청 (기존 알림 완료 레코드가 있어도 is_notified = false로 100% 안전하게 재활성화)
 */
export async function registerWaitlistAction(targetDate: string, siteId?: string): Promise<{
    success: boolean;
    error?: string;
}> {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return { success: false, error: '로그인이 필요합니다.' };
        }

        const admin = createAdminClient();
        const { error } = await (admin.from('waitlist') as any).upsert({
            user_id: user.id,
            target_date: targetDate,
            site_id: siteId || null,
            is_notified: false,
            notified_at: null,
            created_at: new Date().toISOString()
        }, {
            onConflict: 'user_id,target_date,site_id'
        });

        if (error) {
            console.error('[registerWaitlistAction] DB Upsert error:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (e: any) {
        console.error('[registerWaitlistAction] Exception:', e);
        return { success: false, error: e?.message || '알림 신청 중 오류가 발생했습니다.' };
    }
}

/**
 * 빈자리 알림 대기 취소
 */
export async function cancelWaitlistAction(targetDate: string, siteId?: string): Promise<{
    success: boolean;
    error?: string;
}> {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return { success: false, error: '로그인이 필요합니다.' };
        }

        const admin = createAdminClient();
        let query = (admin.from('waitlist') as any)
            .delete()
            .eq('user_id', user.id)
            .eq('target_date', targetDate);

        if (siteId) {
            query = query.eq('site_id', siteId);
        } else {
            query = query.is('site_id', null);
        }

        const { error } = await query;
        if (error) {
            console.error('[cancelWaitlistAction] DB Delete error:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (e: any) {
        console.error('[cancelWaitlistAction] Exception:', e);
        return { success: false, error: e?.message || '알림 취소 중 오류가 발생했습니다.' };
    }
}
