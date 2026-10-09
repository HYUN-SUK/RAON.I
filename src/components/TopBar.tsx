"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase-client";
import { LogOut, LogIn, Settings, User, Bell, FileText, Download, MapPin } from "lucide-react";
import { toast } from "sonner";
import { pointService } from "@/services/pointService";
import { getLevelInfo } from "@/config/pointPolicy";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";

import { useMySpaceStore } from "@/store/useMySpaceStore";
import { useReservationStore } from "@/store/useReservationStore";
import { usePermissionFlow } from "@/hooks/usePermissionFlow";
import { useAppStandaloneDetector } from "@/hooks/useAppStandaloneDetector";
import LocationPermissionPrompt from "@/components/permission/LocationPermissionPrompt";
import PushPermissionPrompt from "@/components/permission/PushPermissionPrompt";
import IOSPWAGuidePrompt from "@/components/permission/IOSPWAGuidePrompt";

interface UserInfo {
    nickname: string;
    avatarUrl?: string;
}

// 모듈 스코프 캐시: SPA 페이지 이동 간 TopBar가 언마운트/리마운트되어도 즉시 상태 보존 (로그인 버튼 깜빡임 0ms 방어)
let cachedAuthState: { isLoggedIn: boolean; userInfo: UserInfo | null } = {
    isLoggedIn: false,
    userInfo: null,
};

// 당일 로그인 보상 및 지갑 갱신 중복 호출 방지 모듈 락
let lastRewardCheckUserId: string | null = null;
let lastRewardCheckDate: string | null = null;

// 플레이스토어 공식 다운로드 URL
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=kr.co.raoni.app";

export default function TopBar() {
    const { level, xp, raonToken, setWallet, reset } = useMySpaceStore();
    const router = useRouter();
    const pathname = usePathname();
    const supabase = createClient();
    const [isLoggedIn, setIsLoggedIn] = useState(() => cachedAuthState.isLoggedIn);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(() => cachedAuthState.userInfo);

    // 앱 설치 여부 감지 (앱 사용자 감춤, 웹 사용자 전용 주황색 버튼 노출)
    const { isAppUser, isMounted } = useAppStandaloneDetector();

    // Permission Flow
    const {
        showLocationPrompt,
        showPushPrompt,
        showIOSPWAPrompt,
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
    } = usePermissionFlow();

    // Dynamic Level Progress
    const { progress } = getLevelInfo(xp);

    // 당일 로그인 보상 및 지갑 갱신 중복 호출 방지 락
    const loginRewardProcessedRef = useRef<string | null>(null);

    const handleDailyLoginReward = async (user: { id: string }) => {
        if (!user?.id) return;
        const todayStr = new Date().toISOString().split('T')[0];
        if (lastRewardCheckUserId === user.id && lastRewardCheckDate === todayStr) {
            return; // 이미 당일 1회 보상 및 지갑 동기화 완료 (페이지 전환 시 중복 호출 방어)
        }
        lastRewardCheckUserId = user.id;
        lastRewardCheckDate = todayStr;
        loginRewardProcessedRef.current = user.id;

        try {
            const reward = await pointService.grantAction(user.id, 'LOGIN');
            if (reward.success) {
                toast.success("매일 로그인 보상! 경험치 +10xp, 라온토큰 +1개 획득 🎁");
            }

            // 지갑 갱신
            const wallet = await pointService.getWallet(user.id);
            if (wallet) {
                setWallet(wallet.xp, wallet.level, wallet.raonToken);
            }

            // 첫 로그인 시 권한 플로우 시작
            if (isFirstLoginPrompt()) {
                markFirstLoginPrompted();
                setTimeout(() => {
                    startFlow();
                }, 2000);
            }
        } catch (error) {
            console.error("Login reward/sync failed:", error);
        }
    };

    const checkUser = async () => {
        try {
            // [0ms 즉시 복원] 로컬스토리지 캐시가 있으면 네트워크 응답 전 즉각 바인딩
            if (typeof window !== 'undefined' && !cachedAuthState.isLoggedIn) {
                try {
                    const raw = localStorage.getItem('raon_user_auth_cache');
                    if (raw) {
                        const parsed = JSON.parse(raw);
                        if (parsed?.isLoggedIn && parsed?.userInfo) {
                            cachedAuthState = parsed;
                            setIsLoggedIn(true);
                            setUserInfo(parsed.userInfo);
                        }
                    }
                } catch {}
            }

            const sessionPromise = supabase.auth.getSession();
            const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
                setTimeout(() => resolve({ data: { session: null } }), 3000)
            );
            const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
            const user = session?.user;

            if (user) {
                const info: UserInfo = {
                    nickname: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Camper',
                    avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture
                };
                cachedAuthState = { isLoggedIn: true, userInfo: info };
                try { localStorage.setItem('raon_user_auth_cache', JSON.stringify(cachedAuthState)); } catch {}
                setIsLoggedIn(true);
                setUserInfo(info);

                // 로그인 보상 및 동기화 1회 안전 실행
                handleDailyLoginReward(user);
            } else {
                cachedAuthState = { isLoggedIn: false, userInfo: null };
                try { localStorage.removeItem('raon_user_auth_cache'); } catch {}
                setIsLoggedIn(false);
                setUserInfo(null);
                try { useMySpaceStore.persist?.clearStorage?.(); } catch {}
                reset();
            }
        } catch (e) {
            console.error("checkUser error:", e);
        }
    };

    const clearUserAuthCaches = () => {
        try {
            cachedAuthState = { isLoggedIn: false, userInfo: null };
            lastRewardCheckUserId = null;
            lastRewardCheckDate = null;
            loginRewardProcessedRef.current = null;
            if (typeof window !== 'undefined') {
                localStorage.removeItem('raon_user_auth_cache');
                localStorage.removeItem('user_schedules_cache');
                localStorage.removeItem('last_schedule_sync_date');
                localStorage.removeItem('reservation-storage-v3');
                localStorage.removeItem('reservation-storage-v2');
                localStorage.removeItem('raon_cached_guest_info');
                localStorage.removeItem('raonai_back_from_detail');
                // sb-* 및 auth-token 관련 로컬스토리지 잔여 키 일괄 정리
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const key = localStorage.key(i);
                    if (key && (key.startsWith('sb-') || key.includes('auth-token'))) {
                        localStorage.removeItem(key);
                    }
                }
                try { useMySpaceStore.persist?.clearStorage?.(); } catch {}
                useReservationStore.getState().reset?.();
                useReservationStore.setState({
                    reservations: [],
                    lastReservation: null,
                    rebookData: null,
                    userContactInfo: null,
                });
            }
        } catch (e) {
            console.error('Error clearing auth caches:', e);
        }
    };

    useEffect(() => {
        checkUser();

        // 실시간 세션 변경 감지 리스너 구독 (SDK 표준: 세션 인자 직접 활용 및 부가 비동기 격리)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || (event === 'INITIAL_SESSION' && session)) {
                const user = session?.user;
                if (user) {
                    const info: UserInfo = {
                        nickname: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Camper',
                        avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture
                    };
                    cachedAuthState = { isLoggedIn: true, userInfo: info };
                    try { localStorage.setItem('raon_user_auth_cache', JSON.stringify(cachedAuthState)); } catch {}
                    setIsLoggedIn(true);
                    setUserInfo(info);

                    // SDK 이벤트 루프 차단을 방지하기 위해 보상 및 지갑 갱신을 비동기 큐로 분리 (1회 락 보장)
                    setTimeout(() => {
                        handleDailyLoginReward(user);
                    }, 0);
                }
            } else if (event === 'SIGNED_OUT') {
                loginRewardProcessedRef.current = null;
                lastRewardCheckUserId = null;
                lastRewardCheckDate = null;
                cachedAuthState = { isLoggedIn: false, userInfo: null };
                setIsLoggedIn(false);
                setUserInfo(null);
                clearUserAuthCaches();
                reset();
            } else if (session) {
                setIsLoggedIn(true);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 페이지 경로 전환 시 최신 로그인 세션 동기화 (최초 마운트 시 중복 실행 방어)
    const isFirstMountRef = useRef(true);
    useEffect(() => {
        if (isFirstMountRef.current) {
            isFirstMountRef.current = false;
            return;
        }
        checkUser();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    const handleLogin = () => {
        router.push('/login');
    };

    const handleLogout = async () => {
        try {
            const signOutPromise = supabase.auth.signOut();
            const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 1500));
            await Promise.race([signOutPromise, timeoutPromise]);
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            clearUserAuthCaches();
            toast.success('로그아웃 되었습니다.');
            setIsLoggedIn(false);
            setUserInfo(null);
            reset(); // Reset global store state
            window.location.href = '/';
        }
    };

    // 플레이스토어 1초 직통 연결 이동
    const handleDownloadClick = () => {
        try {
            // 모바일 안드로이드 intent 마켓 주소 시도 후 플레이 스토어 웹 마켓 주소 이동
            window.location.href = PLAY_STORE_URL;
        } catch {
            window.open(PLAY_STORE_URL, '_blank');
        }
    };

    return (
        <header className="sticky top-0 z-[100] w-full bg-white shadow-sm">
            <div className="relative flex justify-between items-center px-5 h-[74px] max-w-[430px] mx-auto">
                {/* Level & XP */}
                <div className="flex flex-col ml-1">
                    <span className="text-[10px] text-stone-500 font-bold mb-0.5">Level {level}</span>
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
                        <div
                            className="h-full bg-[#388E5A] transition-all duration-500 rounded-full"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <span className="text-[10px] text-stone-400 font-medium leading-none">
                        Raon Token <span className="text-[#388E5A] font-bold ml-0.5">{raonToken}개</span>
                    </span>
                </div>

                {/* Logo - Centered */}
                <div className="flex flex-col items-center justify-center absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 pointer-events-none select-none py-1">
                    <h1 className="text-[21px] sm:text-[22px] font-black text-[#1E4D2B] dark:text-emerald-400 tracking-widest font-sans leading-none">
                        RAON.I
                    </h1>
                    <span className="text-[13.5px] sm:text-[14px] font-bold text-[#3A3A3A] dark:text-stone-300 tracking-tight mt-1.5 leading-none whitespace-nowrap">
                        스마트 여행수첩
                    </span>
                </div>

                {/* Right Side: Auth & Download Badge */}
                <div className="relative flex items-center gap-2 -mr-2">
                {/* Auth Action Icon */}
                {isLoggedIn ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className="relative z-[101] rounded-full overflow-hidden hover:opacity-80 transition-opacity outline-none"
                                aria-label="Settings"
                            >
                                {userInfo?.avatarUrl ? (
                                    <div className="relative w-9 h-9 border border-gray-200 rounded-full overflow-hidden">
                                        <Image
                                            src={userInfo.avatarUrl}
                                            alt="Profile"
                                            fill
                                            className="object-cover"
                                            sizes="36px"
                                        />
                                    </div>
                                ) : (
                                    <div className="p-2 text-text-1 hover:bg-gray-100 rounded-full">
                                        <Settings size={22} strokeWidth={1.5} />
                                    </div>
                                )}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-zinc-900 shadow-xl rounded-2xl p-1.5 border border-stone-200 dark:border-zinc-800">
                            <DropdownMenuLabel className="px-3 py-2 text-xs font-bold text-stone-900 dark:text-stone-100">
                                {userInfo?.nickname || '내 계정'}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => router.push('/myspace')} className="cursor-pointer rounded-xl px-3 py-2 text-xs font-medium">
                                <User className="mr-2 h-4 w-4 text-stone-500" />
                                <span>프로필 / 내 공간</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {/* 1. 알림 수신 동의 토글 */}
                            <div 
                                className="flex items-center justify-between px-3 py-2 hover:bg-stone-50 dark:hover:bg-zinc-800/60 rounded-xl transition-colors cursor-pointer select-none"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    togglePushConsent(!pushGranted);
                                }}
                            >
                                <div className="flex items-center gap-2 text-xs font-semibold text-stone-800 dark:text-stone-200">
                                    <Bell className={`w-4 h-4 shrink-0 transition-colors ${pushGranted ? 'text-amber-600 dark:text-amber-400' : 'text-stone-400'}`} />
                                    <span>알림 수신 동의</span>
                                </div>
                                <Switch 
                                    checked={pushGranted} 
                                    onCheckedChange={(val) => togglePushConsent(val)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="data-[state=checked]:bg-emerald-600 scale-90"
                                />
                            </div>

                            {/* 2. 위치 정보 이용 동의 토글 */}
                            <div 
                                className="flex items-center justify-between px-3 py-2 hover:bg-stone-50 dark:hover:bg-zinc-800/60 rounded-xl transition-colors cursor-pointer select-none"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleLocationConsent(!locationGranted);
                                }}
                            >
                                <div className="flex items-center gap-2 text-xs font-semibold text-stone-800 dark:text-stone-200">
                                    <MapPin className={`w-4 h-4 shrink-0 transition-colors ${locationGranted ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400'}`} />
                                    <span>위치 정보 이용 동의</span>
                                </div>
                                <Switch 
                                    checked={locationGranted} 
                                    onCheckedChange={(val) => toggleLocationConsent(val)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="data-[state=checked]:bg-emerald-600 scale-90"
                                />
                            </div>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem onClick={() => router.push('/terms')} className="cursor-pointer rounded-xl px-3 py-2 text-xs font-medium">
                                <FileText className="mr-2 h-4 w-4 text-stone-500" />
                                <span>이용 약관</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push('/privacy-policy')} className="cursor-pointer rounded-xl px-3 py-2 text-xs font-medium">
                                <FileText className="mr-2 h-4 w-4 text-stone-500" />
                                <span>개인정보처리방침</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push('/myspace/settings/withdraw')} className="cursor-pointer text-stone-500 rounded-xl px-3 py-2 text-xs font-medium">
                                <Settings className="mr-2 h-4 w-4" />
                                <span>회원 탈퇴</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 cursor-pointer rounded-xl px-3 py-2 text-xs font-medium">
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>로그아웃</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <button
                        onClick={handleLogin}
                        className="relative z-[101] py-1 px-3.5 -mr-1 flex items-center gap-1.5 rounded-full border border-[#388E5A] text-[#388E5A] hover:bg-[#388E5A]/5 transition-colors cursor-pointer bg-white"
                        aria-label="Login"
                    >
                        <LogIn size={16} strokeWidth={2} />
                        <span className="text-sm font-bold text-[#388E5A]">로그인</span>
                    </button>
                )}

                {/* 미설치 웹 유저 전용: 로그인 바로 아래에 달린 주황색 반짝임 다운로드 버튼 (앱 설치자는 감춤) */}
                {isMounted && !isAppUser && (typeof window === 'undefined' || !document.documentElement.classList.contains('is-native-app')) && (
                    <div className="absolute top-[42px] right-1 z-[110] animate-fade-in pointer-events-auto">
                        <button
                            onClick={handleDownloadClick}
                            className="flex items-center gap-1 py-1 px-2.5 rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white font-black text-[11px] shadow-[0_4px_14px_rgba(249,115,22,0.5)] animate-pulse hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/50 whitespace-nowrap"
                            title="구글 플레이 스토어에서 라온아이 앱 다운로드"
                        >
                            <Download size={13} strokeWidth={2.5} className="animate-bounce shrink-0 text-white" />
                            <span className="font-extrabold tracking-tight">앱 다운로드</span>
                        </button>
                    </div>
                )}
            </div>
            </div>

            {/* Permission Flow Prompts */}
            <LocationPermissionPrompt
                isOpen={showLocationPrompt}
                onAccept={() => handleLocationResult(true)}
                onDismiss={() => handleLocationResult(false)}
            />
            <PushPermissionPrompt
                isOpen={showPushPrompt}
                onAccept={() => handlePushResult(true)}
                onDismiss={() => handlePushResult(false)}
            />
            <IOSPWAGuidePrompt
                isOpen={showIOSPWAPrompt}
                onAccept={() => handleIOSPWAResult(true)}
                onDismiss={() => handleIOSPWAResult(false)}
            />
        </header>
    );
}
