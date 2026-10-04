"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase-client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Capacitor } from "@capacitor/core";

export default function SocialLoginButtons() {
    const supabase = createClient();
    const [loading, setLoading] = useState<string | null>(null);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isHandlingSuccessRef = useRef(false);

    const cleanupPoll = useCallback(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
        setLoading(null);
    }, []);

    const pollForSession = useCallback((ticketId: string) => {
        setLoading('kakao');

        const startTime = Date.now();
        const maxWaitTime = 120000; // 2분 타임아웃

        const checkBridge = async () => {
            if (isHandlingSuccessRef.current) return;
            if (Date.now() - startTime > maxWaitTime) {
                cleanupPoll();
                try { localStorage.removeItem('raon_pending_auth_ticket'); } catch {}
                return;
            }

            try {
                const res = await fetch(`/api/auth/bridge?ticket=${encodeURIComponent(ticketId)}`, {
                    cache: 'no-store'
                });
                const data = await res.json();

                if (data.success && data.session && !isHandlingSuccessRef.current) {
                    isHandlingSuccessRef.current = true;
                    cleanupPoll();
                    try { localStorage.removeItem('raon_pending_auth_ticket'); } catch {}

                    toast.success("로그인 성공! 라온아이에 오신 것을 환영합니다 🏕️");

                    // 1. 수파베이스 세션 클라이언트에 안전 안착
                    await supabase.auth.setSession({
                        access_token: data.session.access_token,
                        refresh_token: data.session.refresh_token,
                    });

                    // 2. 홈 화면으로 0초 리다이렉트
                    window.location.replace('/');
                }
            } catch (err) {
                console.warn('[SocialLogin] Polling check error:', err);
            }
        };

        // 1.5초 주기 안전 폴링
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = setInterval(checkBridge, 1500);

        // 사용자가 스마트폰 브라우저에서 인증 후 앱으로 화면 복귀(포커스)했을 때 즉시 0초 체크
        const handleFocus = () => {
            checkBridge();
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleFocus);

        // 즉시 1회 체크
        checkBridge();
    }, [cleanupPoll, supabase]);

    // 앱 마운트 시 대기 중인 티켓이 있으면 즉시 감시 가동 (앱 재진입 대응)
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const pendingTicket = localStorage.getItem('raon_pending_auth_ticket');
            if (pendingTicket && Capacitor.isNativePlatform()) {
                pollForSession(pendingTicket);
            }
        } catch {}

        return () => {
            cleanupPoll();
        };
    }, [pollForSession, cleanupPoll]);

    const handleSocialLogin = async (provider: 'kakao' | 'google') => {
        setLoading(provider);
        try {
            const isNative = Capacitor.isNativePlatform();
            let redirectUrl = `${window.location.origin}/auth/callback`;

            if (isNative) {
                const ticketId = 'ticket_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
                try {
                    localStorage.setItem('raon_pending_auth_ticket', ticketId);
                } catch {}
                redirectUrl = `${window.location.origin}/auth/callback?ticket=${ticketId}&source=native_app`;

                // 백그라운드 폴링 및 포커스 감지 즉시 활성화
                pollForSession(ticketId);
            }

            const options: any = {
                redirectTo: redirectUrl,
            };

            const { error } = await supabase.auth.signInWithOAuth({
                provider: provider as any,
                options,
            });
            if (error) throw error;
        } catch (error: any) {
            toast.error("로그인 실패", { description: error.message });
            setLoading(null);
            cleanupPoll();
        }
    };

    return (
        <div className="flex flex-col gap-3 w-full">
            {/* Kakao Login */}
            <Button
                variant="outline"
                className="w-full h-12 bg-[#FEE500] hover:bg-[#FDD835] text-[#3c1e1e] border-none font-semibold text-[15px] relative"
                onClick={() => handleSocialLogin('kakao')}
                disabled={!!loading}
            >
                {loading === 'kakao' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <>
                        <svg className="w-5 h-5 absolute left-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 3C5.925 3 1 6.925 1 11.775c0 2.925 1.775 5.525 4.525 7.125-.175.625-.65 2.375-.75 2.725-.1.35.125.35.25.225.85-.75 3.375-2.275 3.925-2.65.675.094 1.357.143 2.05.143 6.075 0 11-3.925 11-8.775C22 6.925 17.075 3 12 3z" />
                        </svg>
                        카카오로 3초만에 시작하기
                    </>
                )}
            </Button>



            {/* Google Login */}
            <Button
                variant="outline"
                className="w-full h-12 bg-white hover:bg-gray-50 text-stone-700 border border-stone-200 font-semibold text-[15px] relative"
                onClick={() => handleSocialLogin('google')}
                disabled={!!loading}
            >
                {loading === 'google' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <>
                        <svg className="w-5 h-5 absolute left-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        구글로 계속하기
                    </>
                )}
            </Button>
        </div>
    );
}
