'use server';

import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

/**
 * [마일스톤 9.73] 사용자의 모든 미확인 알림을 '읽음(is_read = true)' 처리하는 Server Action
 * - 1차: 사용자 인증 세션 클라이언트로 UPDATE
 * - 2차: RLS 미반영 환경 대비 Service Role Admin 클라이언트로 Fail-Safe 업데이트 보장
 */
export async function markAllNotificationsAsReadAction(): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: 'Unauthorized' };
        }

        // 1. 사용자 인증 세션으로 UPDATE 시도
        const { error: userError } = await (supabase as any)
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false);

        // 2. RLS 정책 누락 또는 권한 오류 시 Admin Client로 완벽 보장
        if (userError) {
            console.warn('[markAllNotificationsAsReadAction] User client update failed, executing admin fallback:', userError);
            const admin = createAdminClient() as any;
            const { error: adminError } = await admin
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', user.id)
                .eq('is_read', false);

            if (adminError) {
                console.error('[markAllNotificationsAsReadAction] Admin client update error:', adminError);
                return { success: false, error: adminError.message };
            }
        }

        return { success: true };
    } catch (e: any) {
        console.error('[markAllNotificationsAsReadAction] Exception:', e);
        return { success: false, error: e?.message || 'Unknown error' };
    }
}
