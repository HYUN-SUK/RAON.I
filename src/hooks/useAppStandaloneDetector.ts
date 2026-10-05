'use client';

import { useState, useEffect } from 'react';

/**
 * 실시간 OS/브라우저/Capacitor 네이티브 환경을 기반으로 실제 설치된 앱 실행 상태를 판별하는 헬퍼
 */
function checkIsAppUserSync(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        // 1. Capacitor 정식 네이티브 앱 환경 감지 (0초 즉시)
        const isCapacitorNative = !!(
            (window as any).Capacitor?.isNativePlatform?.() ||
            (window as any).Capacitor?.getPlatform?.() === 'android' ||
            (window as any).Capacitor?.getPlatform?.() === 'ios' ||
            document.documentElement.classList.contains('is-native-app') ||
            localStorage.getItem('is_native_installed') === 'true'
        );
        if (isCapacitorNative) return true;

        // 2. 안드로이드 TWA / PWA display-mode: standalone
        const isStandaloneMedia = window.matchMedia?.('(display-mode: standalone)')?.matches ?? false;

        // 3. 풀스크린 앱 디스플레이 모드 감지
        const isFullscreenMedia = window.matchMedia?.('(display-mode: fullscreen)')?.matches ?? false;

        // 4. iOS Safari / Native App standalone 감지
        const isIOSStandalone = (window.navigator as any).standalone === true;

        // 5. 안드로이드 OS 전용 앱 세션 출처 감지 (android-app://)
        const isAndroidAppReferrer = document.referrer?.includes('android-app://') ?? false;

        return isStandaloneMedia || isFullscreenMedia || isIOSStandalone || isAndroidAppReferrer;
    } catch {
        return false;
    }
}

/**
 * 실시간 OS/브라우저 디스플레이 모드 및 Capacitor 네이티브를 기반으로 앱 실행 상태를 판별하는 훅
 * - 실제 플레이 스토어 앱 설치 후 앱으로 구동 시 ➔ isAppUser: true (다운로드 버튼 0초부터 미노출)
 * - 앱 삭제 후 웹 접속 or 카카오톡/크롬 모바일 웹 접속 시 ➔ isAppUser: false (다운로드 버튼 정상 노출)
 */
export function useAppStandaloneDetector() {
    const [isAppUser, setIsAppUser] = useState<boolean>(() => checkIsAppUserSync());
    const [isMounted, setIsMounted] = useState<boolean>(false);

    useEffect(() => {
        setIsMounted(true);
        const liveAppStatus = checkIsAppUserSync();
        setIsAppUser(liveAppStatus);
        if (liveAppStatus) {
            try {
                localStorage.setItem('is_native_installed', 'true');
            } catch {}
        }
    }, []);

    return { isAppUser, isMounted };
}

