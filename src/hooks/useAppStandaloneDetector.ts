'use client';

import { useState, useEffect } from 'react';

/**
 * 오직 실시간 OS/브라우저 디스플레이 모드를 기반으로 실제 설치된 앱 실행 상태를 판별하는 훅
 * - 실제 플레이 스토어 앱 설치 후 앱으로 구동 시 ➔ display-mode: standalone/fullscreen 감지 ➔ isAppUser: true (버튼 감춤)
 * - 앱 삭제 후 웹 접속 or 카카오톡/크롬 모바일 웹 접속 시 ➔ isAppUser: false (주황색 반짝임 다운로드 버튼 100% 노출)
 */
export function useAppStandaloneDetector() {
    const [isAppUser, setIsAppUser] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        if (typeof window === 'undefined') return;

        try {
            // 1. 안드로이드 TWA / 플레이스토어 앱 실행 시 OS가 부여하는 display-mode: standalone 감지
            const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;

            // 2. 풀스크린 앱 디스플레이 모드 감지
            const isFullscreenMedia = window.matchMedia('(display-mode: fullscreen)').matches;

            // 3. iOS Safari / Native App standalone 감지
            const isIOSStandalone = (window.navigator as any).standalone === true;

            // 4. 안드로이드 OS 전용 앱 세션 출처 감지 (android-app://)
            const isAndroidAppReferrer = document.referrer?.includes('android-app://') ?? false;

            // 실시간 OS 디스플레이 모드 4중 하드웨어 감지
            const isRealAppEnvironment = isStandaloneMedia || isFullscreenMedia || isIOSStandalone || isAndroidAppReferrer;

            setIsAppUser(isRealAppEnvironment);
        } catch (e) {
            console.warn('[useAppStandaloneDetector] Live OS detection error:', e);
            setIsAppUser(false);
        }
    }, []);

    return { isAppUser, isMounted };
}
