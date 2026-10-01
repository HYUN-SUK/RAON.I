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
                                const expiresAt = parsed?.expires_at || parsed?.currentSession?.expires_at;
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

        if (hasValidStorageToken) {
            await action();
            return;
        }

        // [Fast-Path 2] @supabase/ssr 쿠키 및 토큰 부재 시 0ms 즉시 안내 다이얼로그 노출 (불필요한 대기 원천 차단)
        const hasCookieToken = typeof document !== 'undefined' && document.cookie.includes('sb-');
        if (!hasCookieToken && !hasValidStorageToken) {
            open();
            return;
        }

        // 쿠키 또는 스토리지에 토큰이 존재하는 경우 Supabase Auth 세션 정밀 조회 (2.5초 타임아웃 페일세이프로 먹통 완벽 방어)
        try {
            const sessionPromise = supabase.auth.getSession();
            const timeoutPromise = new Promise<{ data: { session: null }; error: Error }>((resolve) =>
                setTimeout(() => resolve({ data: { session: null }, error: new Error('AUTH_TIMEOUT') }), 2500)
            );
            const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]);

            if (!error && session?.user) {
                await action();
            } else {
                open(); // 세션 없음/만료/타임아웃 시 안전하게 전역 로그인 안내 다이얼로그 표시
            }
        } catch (e) {
            console.warn('[useRequireAuth] Auth session check failed. Prompting login:', e);
            open(); // 네트워크 에러나 세션 조회 실패 시에도 무반응 먹통을 방지하고 로그인 모달 오픈
        }
    };

    return { withAuth };
}
