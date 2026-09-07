'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePushNotification } from './usePushNotification';
import { usePWAInstallPrompt } from './usePWAInstallPrompt';
import { createClient } from '@/lib/supabase-client';
import { toast } from 'sonner';

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

    const [locationGranted, setLocationGranted] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            const val = localStorage.getItem(STORAGE_KEYS.LOCATION_GRANTED);
            if (val === 'false') return false;
            return true; // 기본값 ON (동의 우선 원칙)
        }
        return true;
    });

    const [pushGranted, setPushGranted] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            const val = localStorage.getItem(STORAGE_KEYS.PUSH_GRANTED);
            if (val === 'false') return false;
            return true; // 기본값 ON (동의 우선 원칙)
        }
        return true;
    });

    const supabase = createClient();
    const { requestPermission, permission: pushPermission } = usePushNotification();
    const { platform } = usePWAInstallPrompt();

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

    // 초기 마운트 시 실제 브라우저 권한 및 DB 상태 통합 동기화 & 실시간 리스너 바인딩
    useEffect(() => {
        let isCancelled = false;

        const syncConsents = async () => {
            if (typeof window === 'undefined') return;

            const localLoc = localStorage.getItem(STORAGE_KEYS.LOCATION_GRANTED);
            const localPush = localStorage.getItem(STORAGE_KEYS.PUSH_GRANTED);

            let actualLocation = localLoc === 'false' ? false : true;
            let actualPush = localPush === 'false' ? false : true;

            // 1. 브라우저에서 명시적으로 차단('denied')된 경우에만 OFF 처리
            if (typeof navigator !== 'undefined' && navigator.permissions) {
                try {
                    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
                    if (!isCancelled) {
                        if (status.state === 'denied') {
                            actualLocation = false;
                        } else if (localLoc !== 'false') {
                            actualLocation = true;
                        }
                    }

                    // 브라우저 권한 실시간 변경 감지
                    status.onchange = () => {
                        const isLocOff = localStorage.getItem(STORAGE_KEYS.LOCATION_GRANTED) === 'false';
                        if (status.state === 'granted') {
                            if (!isLocOff) {
                                setLocationGranted(true);
                                localStorage.setItem(STORAGE_KEYS.LOCATION_GRANTED, 'true');
                                saveConsentToServer('location', true);
                            }
                        } else if (status.state === 'denied') {
                            setLocationGranted(false);
                        }
                    };
                } catch {
                    // query 미지원 환경 대비 안전 처리
                }
            }

            // 2. 알림 권한: 브라우저에서 차단('denied')된 경우만 OFF
            if (localPush === 'false') {
                actualPush = false;
            } else if (typeof Notification !== 'undefined') {
                if (Notification.permission === 'denied') {
                    actualPush = false;
                } else {
                    actualPush = true;
                }
            }

            // 3. DB 저장 내역 동기화
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user && !isCancelled) {
                    const { data: consent } = await supabase
                        .from('user_permission_consents')
                        .select('location_granted, push_granted')
                        .eq('user_id', user.id)
                        .maybeSingle();

                    if (consent) {
                        if (consent.location_granted === false && localLoc === 'false') {
                            actualLocation = false;
                        } else if (consent.location_granted === true && localLoc !== 'false') {
                            actualLocation = true;
                        }

                        if (consent.push_granted === false && localPush === 'false') {
                            actualPush = false;
                        } else if (consent.push_granted === true && localPush !== 'false') {
                            actualPush = true;
                        }
                    }

                    // 기본 ON 상태를 DB에도 자동 동기화
                    if (actualLocation === true && (!consent || !consent.location_granted)) {
                        saveConsentToServer('location', true);
                    }
                    if (actualPush === true && (!consent || !consent.push_granted)) {
                        saveConsentToServer('push', true);
                    }
                }
            } catch (e) {
                console.warn('[PermissionFlow] Consent sync warning:', e);
            }

            if (!isCancelled) {
                setLocationGranted(actualLocation);
                if (actualLocation && localLoc !== 'false') {
                    localStorage.setItem(STORAGE_KEYS.LOCATION_GRANTED, 'true');
                }

                setPushGranted(actualPush);
                if (actualPush && localPush !== 'false') {
                    localStorage.setItem(STORAGE_KEYS.PUSH_GRANTED, 'true');
                }
            }
        };

        syncConsents();

        // 4. 화면 복귀(포커스/탭 전환) 시 권한 실시간 재확인
        const handleVisibilityOrFocus = () => {
            if (typeof window === 'undefined') return;
            const isLocOff = localStorage.getItem(STORAGE_KEYS.LOCATION_GRANTED) === 'false';
            const isPushOff = localStorage.getItem(STORAGE_KEYS.PUSH_GRANTED) === 'false';

            if (typeof Notification !== 'undefined') {
                if (Notification.permission === 'granted' && !isPushOff) {
                    setPushGranted(true);
                    localStorage.setItem(STORAGE_KEYS.PUSH_GRANTED, 'true');
                } else if (Notification.permission === 'denied') {
                    setPushGranted(false);
                }
            }

            if (typeof navigator !== 'undefined' && navigator.permissions) {
                navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((res) => {
                    if (res.state === 'granted' && !isLocOff) {
                        setLocationGranted(true);
                        localStorage.setItem(STORAGE_KEYS.LOCATION_GRANTED, 'true');
                    } else if (res.state === 'denied') {
                        setLocationGranted(false);
                    }
                }).catch(() => {});
            }
        };

        window.addEventListener('focus', handleVisibilityOrFocus);
        document.addEventListener('visibilitychange', handleVisibilityOrFocus);

        return () => {
            isCancelled = true;
            window.removeEventListener('focus', handleVisibilityOrFocus);
            document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
        };
    }, [supabase, saveConsentToServer]);

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

        // [v13.7.0] DB user_permission_consents 직접 확인 (계정 전환 및 기기 변경 시 중복 팝업 원천 방어)
        let dbLocationGranted = false;
        let dbPushGranted = false;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: consent } = await supabase
                    .from('user_permission_consents')
                    .select('location_granted, push_granted')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (consent) {
                    if (consent.location_granted) {
                        dbLocationGranted = true;
                        localStorage.setItem(STORAGE_KEYS.LOCATION_GRANTED, 'true');
                    }
                    if (consent.push_granted) {
                        dbPushGranted = true;
                        localStorage.setItem(STORAGE_KEYS.PUSH_GRANTED, 'true');
                    }
                }
            }
        } catch (e) {
            console.warn('[PermissionFlow] Failed to fetch DB consents:', e);
        }

        // 위치 권한 확인 (브라우저 실제 권한, 로컬스토리지 또는 DB 동의 완료 여부)
        let hasBrowserLocation = false;
        if (typeof navigator !== 'undefined' && navigator.permissions) {
            try {
                const res = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
                if (res.state === 'granted') hasBrowserLocation = true;
            } catch {}
        }
        const locationGranted = hasBrowserLocation || dbLocationGranted || localStorage.getItem(STORAGE_KEYS.LOCATION_GRANTED) === 'true';
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
        moveToStepPush(dbPushGranted);
    }, [isInCooldown, supabase]);

    // 푸시 단계로 이동
    const moveToStepPush = useCallback((dbPushGranted?: boolean) => {
        const pushGranted = dbPushGranted || localStorage.getItem(STORAGE_KEYS.PUSH_GRANTED) === 'true';
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

    // 위치 동의 ON/OFF 토글
    const toggleLocationConsent = useCallback(async (enable: boolean) => {
        if (enable) {
            // 위치 켜기: 브라우저 위치 권한 요청/확인
            if (typeof navigator !== 'undefined' && navigator.geolocation) {
                try {
                    await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            timeout: 5000,
                            enableHighAccuracy: true,
                            maximumAge: 0,
                        });
                    });
                    setLocationGranted(true);
                    localStorage.setItem(STORAGE_KEYS.LOCATION_GRANTED, 'true');
                    await saveConsentToServer('location', true);
                    toast.success("📍 위치 정보 이용에 동의하셨습니다.");
                } catch (err: any) {
                    console.warn("Location permission request failed:", err);
                    if (err?.code === 1) { // PERMISSION_DENIED
                        toast.error("브라우저 위치 권한이 차단되어 있습니다. 주소창의 🔒 아이콘에서 위치를 허용해 주세요.");
                    } else {
                        setLocationGranted(true);
                        localStorage.setItem(STORAGE_KEYS.LOCATION_GRANTED, 'true');
                        await saveConsentToServer('location', true);
                        toast.success("📍 위치 정보 이용에 동의하셨습니다.");
                    }
                }
            } else {
                toast.error("이 브라우저는 위치 서비스를 지원하지 않습니다.");
            }
        } else {
            // 위치 끄기
            setLocationGranted(false);
            localStorage.setItem(STORAGE_KEYS.LOCATION_GRANTED, 'false');
            await saveConsentToServer('location', false);
            toast.info("📍 위치 정보 이용 동의가 해제되었습니다. 내 주변 검색 시 기본 위치로 안내됩니다.");
        }
    }, [saveConsentToServer]);

    // 푸시 알림 동의 ON/OFF 토글
    const togglePushConsent = useCallback(async (enable: boolean) => {
        if (enable) {
            // 알림 켜기: 브라우저 푸시 권한 요청
            const token = await requestPermission(true);
            const isGranted = (typeof Notification !== 'undefined' && Notification.permission === 'granted') || !!token;
            if (isGranted) {
                setPushGranted(true);
                localStorage.setItem(STORAGE_KEYS.PUSH_GRANTED, 'true');
                await saveConsentToServer('push', true);
                toast.success("🔔 알림 수신에 동의하셨습니다.");
            } else {
                toast.error("브라우저 알림 권한이 차단되어 있습니다. 주소창의 🔒 아이콘에서 알림을 허용해 주세요.");
            }
        } else {
            // 알림 끄기
            setPushGranted(false);
            localStorage.setItem(STORAGE_KEYS.PUSH_GRANTED, 'false');
            await saveConsentToServer('push', false);
            toast.info("🔔 알림 수신 동의가 해제되었습니다.");
        }
    }, [requestPermission, saveConsentToServer]);

    return {
        ...state,
        locationGranted,
        pushGranted,
        toggleLocationConsent,
        togglePushConsent,
        startFlow,
        handleLocationResult,
        handlePushResult,
        handleIOSPWAResult,
        isFirstLoginPrompt,
        markFirstLoginPrompted,
    };
}
