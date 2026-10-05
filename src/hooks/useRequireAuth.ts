"use client";

import { createClient } from "@/lib/supabase-client";
import { useAuthModalStore } from "@/store/useAuthModalStore";

export function useRequireAuth() {
    const { open } = useAuthModalStore();

    /**
     * Wraps an action with a login check.
     */
    const withAuth = async (action: () => void | Promise<void>) => {
        const supabase = createClient();

        // [Fast-Path 1] 로컬스토리지 토큰 정밀 검사
        let hasValidStorageToken = false;
        let hasRefreshToken = false;
        let hasStoredUser = false;

        try {
            if (typeof window !== 'undefined') {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && (key.includes('auth-token') || key.startsWith('sb-'))) {
                        const raw = localStorage.getItem(key);
                        if (raw) {
                            try {
                                const parsed = JSON.parse(raw);
                                const token = parsed?.access_token || parsed?.currentSession?.access_token;
                                const refreshToken = parsed?.refresh_token || parsed?.currentSession?.refresh_token;
                                const user = parsed?.user || parsed?.currentSession?.user;
                                const expiresAt = parsed?.expires_at || parsed?.currentSession?.expires_at;

                                if (refreshToken) hasRefreshToken = true;
                                if (user?.id) hasStoredUser = true;

                                if (token && typeof expiresAt === 'number' && expiresAt * 1000 > Date.now()) {
                                    hasValidStorageToken = true;
                                    break;
                                }
                            } catch {}
                        }
                    }
                }
            }
        } catch {
            hasValidStorageToken = false;
        }

        // 1. 유효한 access_token이 있으면 0ms 즉시 통과
        if (hasValidStorageToken) {
            await action();
            return;
        }

        // [Fast-Path 2] 토큰도, 리프레시 토큰도, 쿠키도 아예 없는 명백한 비로그인 상태일 때만 0ms 즉시 로그인 팝업 노출
        const hasCookieToken = typeof document !== 'undefined' && document.cookie.includes('sb-');
        if (!hasCookieToken && !hasValidStorageToken && !hasRefreshToken && !hasStoredUser) {
            open();
            return;
        }

        // 2. 만료된 access_token이지만 refresh_token/쿠키가 있는 경우 (1시간 주기 만료)
        // 백그라운드 Silent Token Refresh 대기 (5초 넉넉한 타임아웃)
        try {
            const sessionPromise = supabase.auth.getSession();
            const timeoutPromise = new Promise<{ data: { session: null }; error: Error }>((resolve) =>
                setTimeout(() => resolve({ data: { session: null }, error: new Error('AUTH_TIMEOUT') }), 5000)
            );
            const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]);

            if (!error && session?.user) {
                await action();
            } else if (hasRefreshToken || hasStoredUser) {
                // 일시적인 네트워크 지연으로 getSession이 타임아웃되었더라도,
                // 이미 기기에 로그인 인증 정보(리프레시 토큰/유저)가 확실히 남아있다면 사용자 차단 팝업을 띄우지 않고 진입 허용
                console.warn('[useRequireAuth] Session refresh pending, allowing action on cached credentials');
                await action();
            } else {
                open(); // 세션 없음/만료 시 안전하게 전역 로그인 안내 다이얼로그 표시
            }
        } catch (e) {
            console.warn('[useRequireAuth] Auth session check failed:', e);
            if (hasRefreshToken || hasStoredUser) {
                await action();
            } else {
                open();
            }
        }
    };

    return { withAuth };
}
