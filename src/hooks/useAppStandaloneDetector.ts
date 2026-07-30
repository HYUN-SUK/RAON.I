'use client';

import { useState, useEffect } from 'react';

/**
 * 유저가 이미 앱(PWA/TWA/Native WebView)을 설치하여 단독 앱 환경으로 실행 중인지 판별하는 커스텀 훅
 * - isAppUser가 true이면 이미 앱을 설치하여 사용하는 캠퍼 ➔ 다운로드 버튼 감춤
 * - isAppUser가 false이면 웹 브라우저 접속자 ➔ 주황색 반짝임 다운로드 버튼 노출
 */
export function useAppStandaloneDetector() {
    const [isAppUser, setIsAppUser] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        if (typeof window === 'undefined') return;

        try {
            // 1. matchMedia (display-mode: standalone) 감지 (안드로이드/TWA/PWA 앱)
            const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;

            // 2. iOS Safari Navigator standalone 감지
            const isIOSStandalone = (window.navigator as any).standalone === true;

            // 3. Document Referrer 내 android-app:// 감지
            const isAndroidAppReferrer = document.referrer?.includes('android-app://') ?? false;

            // 4. User Agent 내 TWA / Custom App / WebView 키워드 감지
            const ua = navigator.userAgent.toLowerCase();
            const isCustomAppUA = ua.includes('raoni') || ua.includes('twa') || (ua.includes('wv') && ua.includes('android'));

            const detectedAsApp = isStandaloneMedia || isIOSStandalone || isAndroidAppReferrer || isCustomAppUA;
            setIsAppUser(detectedAsApp);
        } catch (e) {
            console.warn('[useAppStandaloneDetector] Detection error:', e);
            setIsAppUser(false);
        }
    }, []);

    return { isAppUser, isMounted };
}
