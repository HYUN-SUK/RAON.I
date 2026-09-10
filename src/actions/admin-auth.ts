'use server';

import { createClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

/**
 * 관리자 전용 서버 로그아웃 Server Action
 * 1. Supabase 서버 세션 파기
 * 2. Next.js 서버 레벨에서 sb-* 인증 쿠키 즉시 강제 소멸 (Max-Age=0)
 */
export async function adminSignOutAction(): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();
        await supabase.auth.signOut();
    } catch (e: any) {
        console.error('[adminSignOutAction] Supabase signOut error:', e?.message || e);
    }

    try {
        const cookieStore = await cookies();
        const allCookies = cookieStore.getAll();
        for (const cookie of allCookies) {
            if (cookie.name.startsWith('sb-') || cookie.name.includes('auth-token')) {
                cookieStore.delete(cookie.name);
            }
        }
    } catch (e: any) {
        console.error('[adminSignOutAction] Cookie delete error:', e?.message || e);
    }

    return { success: true };
}
