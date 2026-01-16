'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePushNotification } from './usePushNotification';
import { usePWAInstallPrompt } from './usePWAInstallPrompt';
import { createClient } from '@/lib/supabase-client';

// 로컬 스토리지 키
const STORAGE_KEYS = {
    // 위치 권한
    LOCATION_GRANTED: 'raon_location_granted',
    LOCATION_DISMISSED_AT: 'raon_location_dismissed_at',

    // 푸시 권한
    PUSH_GRANTED: 'raon_push_granted',
    PUSH_DISMISSED_AT: 'raon_push_dismissed_at',

    // 플로우 상태
    PERMISSION_FLOW_COMPLETED: 'raon_permission_flow_completed',
    FIRST_LOGIN_PROMPTED: 'raon_first_login_prompted',
};

// 24시간 (밀리초)
const DISMISS_COOLDOWN = 24 * 60 * 60 * 1000;

export type PermissionStep = 'idle' | 'location' | 'push' | 'ios_pwa' | 'done';

interface PermissionFlowState {
    currentStep: PermissionStep;
    showLocationPrompt: boolean;
    showPushPrompt: boolean;
    showIOSPWAPrompt: boolean;
}

export function usePermissionFlow() {
    const [state, setState] = useState<PermissionFlowState>({
        currentStep: 'idle',
        showLocationPrompt: false,
        showPushPrompt: false,
        showIOSPWAPrompt: false,
    });

    const supabase = createClient();
    const { requestPermission, permission: pushPermission } = usePushNotification();
    const { platform } = usePWAInstallPrompt();

    // iOS Safari 감지
    const isIOSSafari = platform === 'ios';

    // PWA 설치 여부 확인 (standalone 모드)
    const isPWAInstalled = typeof window !== 'undefined' &&
        (window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true);

    // 위치 권한 상태 확인
    const checkLocationPermission = useCallback(() => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) return 'unsupported';
        if (typeof navigator.permissions === 'undefined') return 'unknown';

        return navigator.permissions.query({ name: 'geolocation' }).then(result => result.state);
    }, []);

    // 쿨다운 확인 (24시간)
    const isInCooldown = useCallback((key: string) => {
        if (typeof localStorage === 'undefined') return false;
        const dismissedAt = localStorage.getItem(key);
        if (!dismissedAt) return false;

        const elapsed = Date.now() - parseInt(dismissedAt, 10);
        return elapsed < DISMISS_COOLDOWN;
    }, []);

    // 플로우 시작 (첫 로그인 시 호출)
    const startFlow = useCallback(async () => {
        // 이미 완료된 경우 스킵
        const alreadyCompleted = localStorage.getItem(STORAGE_KEYS.PERMISSION_FLOW_COMPLETED);
        if (alreadyCompleted) {
            setState(prev => ({ ...prev, currentStep: 'done' }));
            return;
        }

        // 위치 권한 확인
        const locationGranted = localStorage.getItem(STORAGE_KEYS.LOCATION_GRANTED);
        const locationInCooldown = isInCooldown(STORAGE_KEYS.LOCATION_DISMISSED_AT);

        // 위치 권한이 필요한 경우
        if (!locationGranted && !locationInCooldown) {
            setState({
                currentStep: 'location',
                showLocationPrompt: true,
                showPushPrompt: false,
                showIOSPWAPrompt: false,
            });
            return;
        }

        // 푸시 권한으로 이동
        moveToStepPush();
    }, [isInCooldown]);

    // 푸시 단계로 이동
    const moveToStepPush = useCallback(() => {
        const pushGranted = localStorage.getItem(STORAGE_KEYS.PUSH_GRANTED);
        const pushInCooldown = isInCooldown(STORAGE_KEYS.PUSH_DISMISSED_AT);

        // 푸시 권한이 필요한 경우
        if (!pushGranted && !pushInCooldown && pushPermission !== 'granted') {
            // iOS Safari + PWA 미설치 → iOS PWA 가이드
            if (isIOSSafari && !isPWAInstalled) {
                setState({
                    currentStep: 'ios_pwa',
                    showLocationPrompt: false,
                    showPushPrompt: false,
                    showIOSPWAPrompt: true,
                });
            } else {
                setState({
                    currentStep: 'push',
                    showLocationPrompt: false,
                    showPushPrompt: true,
                    showIOSPWAPrompt: false,
                });
            }
            return;
        }

        // 모든 권한 완료
        completeFlow();
    }, [isInCooldown, pushPermission, isIOSSafari, isPWAInstalled]);

    // 서버에 동의 상태 저장
    const saveConsentToServer = useCallback(async (type: 'location' | 'push', granted: boolean) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const updateData = type === 'location'
                ? { location_granted: granted, location_granted_at: granted ? new Date().toISOString() : null }
                : { push_granted: granted, push_granted_at: granted ? new Date().toISOString() : null };

            await supabase
                .from('user_permission_consents')
                .upsert({
                    user_id: user.id,
                    ...updateData,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
        } catch (error) {
            console.error(`[PermissionFlow] Failed to save ${type} consent:`, error);
        }
    }, [supabase]);

    // 위치 권한 결과 처리
    const handleLocationResult = useCallback(async (accepted: boolean) => {
        let granted = false;
        if (accepted) {
            try {
                // 브라우저 위치 권한 요청
                await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: false,
                        timeout: 10000,
                        maximumAge: 300000,
                    });
                });
                localStorage.setItem(STORAGE_KEYS.LOCATION_GRANTED, 'true');
                granted = true;
            } catch (error) {
                // 거부됨
                localStorage.setItem(STORAGE_KEYS.LOCATION_DISMISSED_AT, Date.now().toString());
            }
        } else {
            // "나중에" 선택
            localStorage.setItem(STORAGE_KEYS.LOCATION_DISMISSED_AT, Date.now().toString());
        }

        // 서버에 동의 상태 저장
        await saveConsentToServer('location', granted);

        // 1.5초 후 푸시 단계로 이동
        setState(prev => ({ ...prev, showLocationPrompt: false }));
        setTimeout(() => {
            moveToStepPush();
        }, 1500);
    }, [moveToStepPush, saveConsentToServer]);

    // 플로우 완료
    const completeFlow = useCallback(() => {
        localStorage.setItem(STORAGE_KEYS.PERMISSION_FLOW_COMPLETED, 'true');
        setState({
            currentStep: 'done',
            showLocationPrompt: false,
            showPushPrompt: false,
            showIOSPWAPrompt: false,
        });
    }, []);

    // 푸시 권한 결과 처리
    const handlePushResult = useCallback(async (accepted: boolean) => {
        let granted = false;
        if (accepted) {
            const token = await requestPermission();
            if (token !== null && token !== undefined) {
                localStorage.setItem(STORAGE_KEYS.PUSH_GRANTED, 'true');
                granted = true;
            } else {
                localStorage.setItem(STORAGE_KEYS.PUSH_DISMISSED_AT, Date.now().toString());
            }
        } else {
            localStorage.setItem(STORAGE_KEYS.PUSH_DISMISSED_AT, Date.now().toString());
        }

        // 서버에 동의 상태 저장
        await saveConsentToServer('push', granted);

        setState(prev => ({ ...prev, showPushPrompt: false }));
        completeFlow();
    }, [requestPermission, completeFlow, saveConsentToServer]);

    // iOS PWA 가이드 결과 처리
    const handleIOSPWAResult = useCallback((accepted: boolean) => {
        if (!accepted) {
            localStorage.setItem(STORAGE_KEYS.PUSH_DISMISSED_AT, Date.now().toString());
        }
        // iOS에서는 PWA 설치 후에도 앱 재시작이 필요하므로 완료 처리
        setState(prev => ({ ...prev, showIOSPWAPrompt: false }));
        completeFlow();
    }, [completeFlow]);

    // 첫 로그인 여부 확인
    const isFirstLoginPrompt = useCallback(() => {
        const prompted = localStorage.getItem(STORAGE_KEYS.FIRST_LOGIN_PROMPTED);
        return !prompted;
    }, []);

    // 첫 로그인 프롬프트 완료 표시
    const markFirstLoginPrompted = useCallback(() => {
        localStorage.setItem(STORAGE_KEYS.FIRST_LOGIN_PROMPTED, 'true');
    }, []);

    return {
        ...state,
        startFlow,
        handleLocationResult,
        handlePushResult,
        handleIOSPWAResult,
        isFirstLoginPrompt,
        markFirstLoginPrompted,
    };
}
