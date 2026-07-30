'use client';

import { useState, useEffect } from 'react';

/**
 * 오직 플레이 스토어에서 직접 설치한 '실제 라온아이 전용 앱(kr.co.raoni.app)' 유저만 감지하는 훅
 * - 일반 웹 접속자 & PWA(홈화면 추가) 유저 ➔ isAppUser: false (주황색 반짝임 다운로드 버튼 100% 노출!)
 * - 플레이스토어에서 설치한 진짜 라온아이 앱 유저 ➔ isAppUser: true (다운로드 버튼 감춤)
 */
export function useAppStandaloneDetector() {
    const [isAppUser, setIsAppUser] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        if (typeof window === 'undefined') return;

        try {
            // 오직 실제 플레이스토어 앱 패키지(kr.co.raoni.app) 출처 식별 감지
            const referrer = document.referrer || '';
            const ua = navigator.userAgent || '';
            const searchParams = new URLSearchParams(window.location.search);

            // 1. 플레이스토어 Android TWA / Native App 공식 패키지 출처 감지 (android-app://kr.co.raoni.app)
            const isOfficialPlayStoreApp = referrer.includes('kr.co.raoni.app');

            // 2. 라온아이 전용 Custom User Agent / App Header 또는 쿼리 파라미터 감지 (예: ?app=true 또는 raoni-app)
            const isCustomAppHeader = ua.includes('kr.co.raoni.app') || ua.includes('RAONI_NATIVE_APP') || searchParams.get('app_mode') === 'true';

            // 오직 100% 플레이 스토어 공식 앱으로 접속한 유저만 앱 유저로 감지
            const isRealInstalledApp = isOfficialPlayStoreApp || isCustomAppHeader;

            setIsAppUser(isRealInstalledApp);
        } catch (e) {
            console.warn('[useAppStandaloneDetector] Detection error:', e);
            setIsAppUser(false);
        }
    }, []);

    return { isAppUser, isMounted };
}
