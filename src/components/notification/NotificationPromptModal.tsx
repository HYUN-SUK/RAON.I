'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bell, CreditCard, Tent, Compass, X, ExternalLink, ArrowRight, ShieldAlert } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { App } from '@capacitor/app';
import { createClient } from '@/lib/supabase-client';
import { firebaseRequestPermission } from '@/lib/firebase';
import { toast } from 'sonner';

export type PromptModalType = 'need_update' | 'os_blocked' | 'need_permission' | null;

const DISMISS_KEY = 'raon_notif_modal_dismissed_until';

export default function NotificationPromptModal() {
    const [modalType, setModalType] = useState<PromptModalType>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const modalTypeRef = React.useRef<PromptModalType>(null);
    modalTypeRef.current = modalType;
    const isOpenRef = React.useRef(false);
    isOpenRef.current = isOpen;

    // 알림 및 앱 버전 통합 점검 함수
    const checkNotificationStatus = useCallback(async () => {
        if (typeof window === 'undefined') return;

        // 1. "오늘 하루 보지 않기" 쿨다운 확인
        try {
            const dismissedUntil = localStorage.getItem(DISMISS_KEY);
            if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
                return;
            }
        } catch {}

        const isNative = Capacitor.isNativePlatform();

        if (isNative) {
            try {
                // 2. [상황 ③ 판별] 네이티브 앱 버전 확인 (versionCode 7 미만인 구버전)
                const appInfo = await App.getInfo();
                const buildVersion = parseInt(appInfo.build, 10);
                if (buildVersion < 7) {
                    setModalType('need_update');
                    setIsOpen(true);
                    return;
                }

                // 3. 네이티브 알림 권한 상태 확인
                const permStatus = await PushNotifications.checkPermissions();
                const inAppConsent = localStorage.getItem('raon_push_granted') !== 'false';

                if (permStatus.receive === 'granted') {
                    // 설정창에서 알림을 켜고 복귀한 경우 축하 토스트 및 푸시 토큰 등록
                    if (isOpenRef.current && modalTypeRef.current === 'os_blocked') {
                        toast.success('휴대폰 알림 허용이 완료되었습니다! 이제 중요 혜택을 놓치지 않아요 🔔');
                        try { await PushNotifications.register(); } catch {}
                    }
                    if (!inAppConsent) {
                        setModalType('need_permission');
                        setIsOpen(true);
                        return;
                    }
                    // 이미 시스템 알림 및 인앱 동의가 완벽히 허용된 상태 -> 팝업 미노출
                    setIsOpen(false);
                    return;
                }

                if (permStatus.receive === 'denied') {
                    // [상황 ① 판별] 스마트폰 OS에서 알림이 차단됨
                    setModalType('os_blocked');
                    setIsOpen(true);
                    return;
                }

                // [상황 ② 판별] 아직 시스템 권한 팝업을 거절하지 않은 대기 상태 (prompt)
                setModalType('need_permission');
                setIsOpen(true);
            } catch (err) {
                console.warn('[NotificationModal] Native status check failed:', err);
            }
        } else {
            // 웹 브라우저 환경
            if (typeof Notification !== 'undefined') {
                const inAppConsent = localStorage.getItem('raon_push_granted') !== 'false';
                if (Notification.permission === 'granted') {
                    if (!inAppConsent) {
                        setModalType('need_permission');
                        setIsOpen(true);
                        return;
                    }
                    setIsOpen(false);
                    return;
                }
                setModalType('need_permission');
                setIsOpen(true);
            }
        }
    }, []);

    useEffect(() => {
        // 앱 진입 1.2초 후 자연스럽게 확인
        const timer = setTimeout(() => {
            checkNotificationStatus();
        }, 1200);

        // 사용자가 설정창이나 스토어에 갔다가 앱으로 복귀했을 때 즉시 재점검
        const handleVisibilityOrFocus = () => {
            checkNotificationStatus();
        };

        window.addEventListener('focus', handleVisibilityOrFocus);
        document.addEventListener('visibilitychange', handleVisibilityOrFocus);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('focus', handleVisibilityOrFocus);
            document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
        };
    }, [checkNotificationStatus]);

    // 우리 앱 자체 수신 동의 100% 즉시 활성화
    const ensureInAppConsent = async () => {
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('raon_push_granted', 'true');
                window.dispatchEvent(new Event('raon_consent_changed'));
                window.dispatchEvent(new Event('storage'));
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await supabase.from('user_permission_consents').upsert({
                        user_id: user.id,
                        push_granted: true,
                        push_granted_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id' });
                }
            } catch (e) {
                console.warn('[NotificationModal] Failed to sync consent to DB:', e);
            }
        }
    };

    // 주 액션 버튼 터치 처리
    const handleMainAction = async () => {
        if (isProcessing) return;
        setIsProcessing(true);

        // 1. [원칙 1] 우리 앱 자체 수신 동의는 무조건 즉시 100% ON으로 켬!
        await ensureInAppConsent();

        const isNative = Capacitor.isNativePlatform();

        // 2. 상황별 동작 분기
        if (modalType === 'need_update') {
            // [상황 ③] 플레이스토어로 직행하여 v1.0.7 업데이트 유도
            try {
                window.location.href = 'market://details?id=kr.co.raoni.app';
            } catch {
                window.open('https://play.google.com/store/apps/details?id=kr.co.raoni.app', '_system');
            }
            setIsProcessing(false);
            setIsOpen(false);
            return;
        }

        if (modalType === 'os_blocked') {
            // [상황 ①] 스마트폰 [애플리케이션 정보 > 알림] 설정창으로 1초 직행
            toast.info('스마트폰 알림 설정 화면으로 이동합니다. 알림 스위치를 켜주세요! 🔔');
            try {
                window.location.href = 'intent:#Intent;action=android.settings.APP_NOTIFICATION_SETTINGS;S.android.provider.extra.APP_PACKAGE=kr.co.raoni.app;S.app_package=kr.co.raoni.app;end';
            } catch {
                try {
                    window.location.href = 'intent:package:kr.co.raoni.app#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;category=android.intent.category.DEFAULT;end';
                } catch {}
            }
            setIsProcessing(false);
            return;
        }

        if (modalType === 'need_permission') {
            // [상황 ②] 안드로이드 공식 시스템 권한 팝업 즉시 호출
            if (isNative) {
                try {
                    const permCheck = await PushNotifications.checkPermissions();
                    if (permCheck.receive === 'granted') {
                        await PushNotifications.register();
                        toast.success('라온아이 알림 수신 설정이 완료되었습니다! 🔔');
                        setIsOpen(false);
                        setIsProcessing(false);
                        return;
                    }
                    const res = await PushNotifications.requestPermissions();
                    if (res.receive === 'granted') {
                        await PushNotifications.register();
                        toast.success('라온아이 알림 수신 설정이 완료되었습니다! 🔔');
                        setIsOpen(false);
                    } else if (res.receive === 'denied') {
                        // 사용자가 거부한 경우 -> 상황 ①(OS 차단)으로 전환
                        setModalType('os_blocked');
                        toast.error('휴대폰 알림이 차단되었습니다. 설정에서 알림을 켜주세요.');
                    }
                } catch (err) {
                    console.error('[NotificationModal] Request permission error:', err);
                }
            } else {
                // 웹 브라우저
                try {
                    const token = await firebaseRequestPermission();
                    if (token) {
                        toast.success('알림 수신 설정이 완료되었습니다! 🔔');
                        setIsOpen(false);
                    }
                } catch (err) {
                    console.error('[NotificationModal] Web permission error:', err);
                }
            }
            setIsProcessing(false);
        }
    };

    // 오늘 하루 보지 않기
    const handleDismissToday = () => {
        try {
            // 24시간 쿨다운 설정
            localStorage.setItem(DISMISS_KEY, (Date.now() + 24 * 60 * 60 * 1000).toString());
        } catch {}
        setIsOpen(false);
    };

    // 다음에 하기 (3시간 쿨다운)
    const handleDismissLater = () => {
        try {
            localStorage.setItem(DISMISS_KEY, (Date.now() + 3 * 60 * 60 * 1000).toString());
        } catch {}
        setIsOpen(false);
    };

    if (!isOpen || !modalType) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-5 text-center relative border border-stone-100 dark:border-zinc-800 animate-in zoom-in-95 duration-200">
                {/* 닫기 버튼 */}
                <button
                    onClick={handleDismissLater}
                    className="absolute right-4 top-4 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-1.5 rounded-full transition-colors"
                    aria-label="닫기"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* 상단 메인 아이콘 배지 */}
                <div className="w-16 h-16 mx-auto rounded-2xl bg-[#E9EFEA] dark:bg-emerald-950/60 text-[#388E5A] dark:text-emerald-400 flex items-center justify-center shadow-inner">
                    {modalType === 'need_update' ? (
                        <ArrowRight className="w-8 h-8 animate-pulse" />
                    ) : modalType === 'os_blocked' ? (
                        <ShieldAlert className="w-8 h-8 text-amber-600" />
                    ) : (
                        <Bell className="w-8 h-8 animate-bounce" />
                    )}
                </div>

                {/* 타이틀 및 헤드라인 */}
                <div className="space-y-1.5">
                    <h3 className="text-xl font-bold text-stone-900 dark:text-stone-100 leading-snug">
                        {modalType === 'need_update' && '최신 버전 업데이트 안내 🚀'}
                        {modalType === 'os_blocked' && '스마트폰 알림이 꺼져 있어요! ⚠️'}
                        {modalType === 'need_permission' && '라온아이 필수 알림을 켜두세요! 🔔'}
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400 font-medium leading-relaxed">
                        {modalType === 'need_update' && '결제 마감 및 빈자리 취소석 알림을 위해 앱을 최신 버전으로 업데이트해 주세요.'}
                        {modalType === 'os_blocked' && '앱 자체 알림은 켜져 있으나, 스마트폰 설정에서 알림이 차단되어 있습니다.'}
                        {modalType === 'need_permission' && '알림을 꺼두시면 중요한 결제 마감 및 취소석 혜택을 놓치실 수 있습니다.'}
                    </p>
                </div>

                {/* 3대 핵심 혜택 안내 카드 */}
                <div className="bg-stone-50 dark:bg-zinc-800/60 rounded-2xl p-3.5 space-y-2.5 text-left border border-stone-100 dark:border-zinc-800">
                    <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                            <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="text-xs font-bold text-stone-800 dark:text-stone-200">결제 기한 안내 (예약 취소 방지)</div>
                            <div className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight">입금 마감(6시간) 임박 시 자동 알림으로 예약 안전 보장</div>
                        </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                            <Tent className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="text-xs font-bold text-stone-800 dark:text-stone-200">실시간 빈자리 취소석 오픈 알림</div>
                            <div className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight">마감된 인기 사이트에 취소석 발생 시 즉시 안내</div>
                        </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0 mt-0.5">
                            <Compass className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="text-xs font-bold text-stone-800 dark:text-stone-200">스마트 여행플랜 & 기상 알림</div>
                            <div className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight">입실 5일 전 맞춤 날씨, 필수 준비물, 주변 행사 안내</div>
                        </div>
                    </div>
                </div>

                {/* 액션 버튼 영역 */}
                <div className="space-y-2 pt-1">
                    <button
                        type="button"
                        disabled={isProcessing}
                        onClick={handleMainAction}
                        className="w-full py-3.5 px-4 rounded-2xl bg-[#388E5A] hover:bg-[#2F774B] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md shadow-[#388E5A]/20 cursor-pointer"
                    >
                        {modalType === 'need_update' && (
                            <>
                                <span>플레이스토어에서 업데이트하기</span>
                                <ExternalLink className="w-4 h-4" />
                            </>
                        )}
                        {modalType === 'os_blocked' && (
                            <>
                                <span>스마트폰 알림 켜러 가기</span>
                                <ExternalLink className="w-4 h-4" />
                            </>
                        )}
                        {modalType === 'need_permission' && (
                            <>
                                <span>알림 켜고 필수 혜택 받기</span>
                                <Bell className="w-4 h-4" />
                            </>
                        )}
                    </button>

                    {/* 하단 닫기 옵션 */}
                    <div className="flex items-center justify-center gap-3 pt-1">
                        <button
                            type="button"
                            onClick={handleDismissToday}
                            className="text-[11px] text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors py-1 px-2"
                        >
                            오늘 하루 보지 않기
                        </button>
                        <span className="text-stone-300 dark:text-zinc-700 text-xs">|</span>
                        <button
                            type="button"
                            onClick={handleDismissLater}
                            className="text-[11px] text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors py-1 px-2"
                        >
                            다음에 하기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
