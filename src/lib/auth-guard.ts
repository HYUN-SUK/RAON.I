import { createClient } from '@/lib/supabase-server';
import { User } from '@supabase/supabase-js';

/**
 * 관리자 권한 검증 함수 (Server Action 및 API 전용)
 * 세션의 이메일이 'admin@raon.ai'이거나 메타데이터 role이 'admin'인 경우만 통과.
 * 실패 시 403 Forbidden Error 발생.
 */
export async function assertAdmin(): Promise<User> {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        throw new Error('403 Forbidden: 로그인이 필요합니다.');
    }

    const isAdmin =
        user.email === 'admin@raon.ai' ||
        user.app_metadata?.role === 'admin' ||
        user.user_metadata?.role === 'admin';

    if (!isAdmin) {
        throw new Error('403 Forbidden: 관리자 권한이 필요합니다.');
    }

    return user;
}

/**
 * 현재 로그인한 사용자 세션 조회 (미인증 시 null 반환)
 */
export async function getCurrentUser(): Promise<User | null> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    } catch {
        return null;
    }
}

/**
 * 현재 사용자가 관리자인지 여부 확인 (boolean 반환)
 */
export async function checkIsAdmin(): Promise<boolean> {
    const user = await getCurrentUser();
    if (!user) return false;

    return (
        user.email === 'admin@raon.ai' ||
        user.app_metadata?.role === 'admin' ||
        user.user_metadata?.role === 'admin'
    );
}
