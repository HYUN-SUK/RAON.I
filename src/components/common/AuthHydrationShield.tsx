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

        const originalPushState = history.pushState;

        history.pushState = function (data: any, unused: string, url?: string | URL | null) {
            const targetUrl = url ? String(url) : '';
            const currentPath = window.location.pathname;

            // 유저가 스케줄/마이스페이스/예약 관련 보호 구역 페이지에 진입해 있는 동안
            const isInsideProtectedArea = currentPath.startsWith('/myspace/schedule') || currentPath.startsWith('/reservation');

            // [Hard Lock] 보호 구역 체류 중 라우터가 자발적으로 순수 홈('/')으로 무소음 pushState 리셋 명령을 때리는 경우 100% 철통 무효화 차단!
            if (isInsideProtectedArea && (targetUrl === '/' || targetUrl === window.location.origin + '/' || targetUrl === window.location.origin)) {
                console.warn('[AuthHydrationShield HardLock] Intercepted silent router bounce to "/" in protected area.');
                return; // 유령 튕김 리다이렉트 스킵!
            }

            return originalPushState.apply(this, arguments as any);
        };

        return () => {
            history.pushState = originalPushState;
        };
    }, []);

    return null;
}
