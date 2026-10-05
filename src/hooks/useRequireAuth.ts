"use client";

import { createClient } from "@/lib/supabase-client";
import { useAuthModalStore } from "@/store/useAuthModalStore";

export function useRequireAuth() {
    const { open } = useAuthModalStore();

    /**
     * Wraps an action with a login check.
     */
    const withAuth = async (action: () => void | Promise<void>) => {
        // [Fast-Path 1] 로컬스토리지 및 쿠키 기반 로그인 상태 정밀 판별
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

        // [@supabase/ssr] 브라우저 쿠키의 Supabase 인증 토큰 검사
        const hasCookieToken = typeof document !== 'undefined' && (
            document.cookie.includes('sb-') ||
            document.cookie.includes('auth-token')
        );

        // 1. [0ms Fast-Path] 기기에 유효한 로그인 정보(스토리지 토큰, 쿠키 토큰, 리프레시 토큰, 유저 프로필)가 존재하면
        // 5초 타임아웃 대기(UI 먹통) 없이 즉시 0ms 만에 액션 실행 (낙관적 쾌속 진입)
        const hasAnyAuthCredential = hasValidStorageToken || hasCookieToken || hasRefreshToken || hasStoredUser;

        if (hasAnyAuthCredential) {
            // 백그라운드에서 세션 유효성 조용히 Revalidate (UI 차단 절대 없음)
            try {
                const supabase = createClient();
                supabase.auth.getSession().catch(() => {});
            } catch {}

            await action();
            return;
        }

        // 2. [명백한 비로그인 상태] 쿠키도 없고, 스토리지 토큰도 전혀 없는 경우 0ms 즉시 로그인 팝업 표시
        open();
    };

    return { withAuth };
}

