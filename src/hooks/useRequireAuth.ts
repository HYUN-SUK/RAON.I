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

        // [Fast-Path] 로컬스토리지에 실제로 만료되지 않은 유효한 세션 토큰이 있는지 정밀 검사
        let hasValidStorageToken = false;
        try {
            if (typeof window !== 'undefined') {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.includes('auth-token')) {
                        const raw = localStorage.getItem(key);
                        if (raw) {
                            const parsed = JSON.parse(raw);
                            const token = parsed?.access_token || parsed?.currentSession?.access_token;
                            const expiresAt = parsed?.expires_at || parsed?.currentSession?.expires_at; // 초 단위 타임스탬프
                            // 실제 access_token이 존재하고 만료 시간이 현재보다 미래인 경우에만 유효한 토큰으로 인정
                            if (token && typeof expiresAt === 'number' && expiresAt * 1000 > Date.now()) {
                                hasValidStorageToken = true;
                                break;
                            }
                        }
                    }
                }
            }
        } catch {
            hasValidStorageToken = false;
        }

        // 실제로 만료되지 않은 토큰이 스토리지에 존재하는 경우 지연 없이 즉시 실행
        if (hasValidStorageToken) {
            await action();
            return;
        }

        // 스토리지에 없거나 만료된 경우 Supabase Auth 서버 세션 정밀 조회
        try {
            const { data: { session }, error } = await supabase.auth.getSession();

            if (!error && session?.user) {
                await action();
            } else {
                open(); // 세션 없음/만료/파기 시 안전하게 전역 로그인 안내 다이얼로그 표시
            }
        } catch (e) {
            console.warn('[useRequireAuth] Auth session check failed. Prompting login:', e);
            open(); // 네트워크 에러나 세션 조회 실패 시에도 무반응 먹통을 방지하고 로그인 모달 오픈
        }
    };

    return { withAuth };
}
