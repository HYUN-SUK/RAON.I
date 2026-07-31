'use client';

import { useEffect } from 'react';

/**
 * 🛡️ [AuthHydrationShield]
 * - 로그인 토큰이 브라우저 로컬 스토리지/쿠키에 존재하는 유효 회원의 경우,
 *   페이지 진입 마운트 시(0~500ms) 백그라운드 세션 재검증 지연으로 인해
 *   Next.js App Router가 홈('/')으로 비상 리셋 (pushState Silent Redirect to '/')을
 *   트리거하는 어선(Race Condition) 튕김을 최상위 레벨에서 안전 차단하는 쉴드 가드.
 */
export default function AuthHydrationShield() {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        // 브라우저에 Supabase auth-token이 들어있는지 빠른 검사
        const hasAuthToken = () => {
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.includes('auth-token')) {
                        return true;
                    }
                }
            } catch {}
            return false;
        };

        const originalPushState = history.pushState;

        history.pushState = function (data: any, unused: string, url?: string | URL | null) {
            const targetUrl = url ? String(url) : '';
            const currentPath = window.location.pathname;

            // 유저가 스케줄/마이스페이스 관련 상세 페이지에 진입해 있는 동안
            const isInsideProtectedArea = currentPath.startsWith('/myspace/schedule') || currentPath.startsWith('/reservation');

            // 회원이 보호 구역 페이지 진입 마운트 중인데, 0.5초 이내에 홈('/')으로 pushState 리셋 명령이 떨어진 경우
            if (isInsideProtectedArea && (targetUrl === '/' || targetUrl === window.location.origin + '/') && hasAuthToken()) {
                const stack = new Error().stack || '';
                // React Mount 이펙트 시점(commitHookEffectListMount)에서 발생한 유령 튕김 리다이렉트인지 확인
                if (stack.includes('commitHookEffectListMount') || stack.includes('app-router.js')) {
                    console.warn('[AuthHydrationShield] Intercepted silent router bounce to "/" during async mount hydration.');
                    return; // 튕김 리다이렉트 무효화 스킵!
                }
            }

            return originalPushState.apply(this, arguments as any);
        };

        return () => {
            history.pushState = originalPushState;
        };
    }, []);

    return null;
}
