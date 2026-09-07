"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase-client";
import { LogOut, LogIn, Settings, User, Bell, FileText, Download, Sparkles, MapPin } from "lucide-react";
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
import { usePushNotification } from "@/hooks/usePushNotification";
import { usePermissionFlow } from "@/hooks/usePermissionFlow";
import { useAppStandaloneDetector } from "@/hooks/useAppStandaloneDetector";
import LocationPermissionPrompt from "@/components/permission/LocationPermissionPrompt";
import PushPermissionPrompt from "@/components/permission/PushPermissionPrompt";
import IOSPWAGuidePrompt from "@/components/permission/IOSPWAGuidePrompt";

interface UserInfo {
    nickname: string;
    avatarUrl?: string;
}

// 플레이스토어 공식 다운로드 URL
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=kr.co.raoni.app";

export default function TopBar() {
    const { level, xp, raonToken, setWallet, reset } = useMySpaceStore();
    const router = useRouter();
    const { requestPermission } = usePushNotification();
    const supabase = createClient();
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

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

    const checkUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        setIsLoggedIn(!!session);

        if (user) {
            // Set User Info
            setUserInfo({
                nickname: user.user_metadata.full_name || user.user_metadata.name || user.email?.split('@')[0] || 'Camper',
                avatarUrl: user.user_metadata.avatar_url || user.user_metadata.picture
            });

            // 1. Try Grant Login Reward
            try {
                const reward = await pointService.grantAction(user.id, 'LOGIN');
                if (reward.success) {
                    toast.success("매일 로그인 보상! 경험치 +10xp, 라온토큰 +1개 획득 🎁");
                }

                // 2. Refresh Wallet
                const wallet = await pointService.getWallet(user.id);
                if (wallet) {
                    setWallet(wallet.xp, wallet.level, wallet.raonToken);
                }
                // 3. 첫 로그인 시 권한 플로우 시작
                if (isFirstLoginPrompt()) {
                    markFirstLoginPrompted();
                    // 약간의 딜레이 후 플로우 시작 (로그인 성공 토스트 확인 후)
                    setTimeout(() => {
                        startFlow();
                    }, 2000);
                }
            } catch (error) {
                console.error("Login reward/sync failed:", error);
            }
        } else {
            setUserInfo(null);
            try { useMySpaceStore.persist?.clearStorage?.(); } catch {}
            reset();
        }
    };

    useEffect(() => {
        checkUser();

        // 실시간 세션 변경 감지 리스너 구독 (명시적 SIGNED_OUT 일 때만 상태 초기화)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
                setIsLoggedIn(true);
                checkUser();
            } else if (event === 'SIGNED_OUT') {
                setIsLoggedIn(false);
                setUserInfo(null);
                try { useMySpaceStore.persist?.clearStorage?.(); } catch {}
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

    const handleLogin = () => {
        router.push('/login');
    };

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut({ scope: 'local' });
            if (typeof window !== 'undefined') {
                try { useMySpaceStore.persist?.clearStorage?.(); } catch {}
            }
            toast.success('로그아웃 되었습니다.');
            setIsLoggedIn(false);
            setUserInfo(null);
            reset(); // Reset global store state
            router.push('/'); // Redirect to home
            router.refresh();
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    // 플레이스토어 1초 직통 연결 이동
    const handleDownloadClick = () => {
        try {
            // 모바일 안드로이드 intent 마켓 주소 시도 후 플레이 스토어 웹 마켓 주소 이동
            window.location.href = PLAY_STORE_URL;
        } catch (e) {
            window.open(PLAY_STORE_URL, '_blank');
        }
    };

    return (
        <header className="sticky top-0 z-[100] flex justify-between items-center px-6 h-[60px] bg-white shadow-sm">
            {/* Level & XP */}
            <div className="flex flex-col ml-1">
                <span className="text-[10px] text-stone-500 font-bold mb-0.5">Level {level}</span>
                <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
                    <div
                        className="h-full bg-green-600 transition-all duration-500 rounded-full"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <span className="text-[10px] text-stone-400 font-medium leading-none">
                    Raon Token <span className="text-orange-600 font-bold ml-0.5">{raonToken}개</span>
                </span>
            </div>

            {/* Logo - Centered */}
            <h1 className="text-lg font-bold text-text-1 tracking-widest font-sans absolute left-1/2 -translate-x-1/2">
                RAON.I
            </h1>

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
                        className="relative z-[101] py-2 px-3 -mr-2 flex items-center gap-1.5 rounded-full hover:bg-gray-100 transition-colors text-text-1 cursor-pointer"
                        aria-label="Login"
                    >
                        <LogIn size={18} strokeWidth={1.5} />
                        <span className="text-sm font-semibold text-stone-600">로그인</span>
                    </button>
                )}

                {/* 미설치 웹 유저 전용: 로그인 바로 아래에 달린 주황색 반짝임 다운로드 버튼 (앱 설치자는 감춤) */}
                {isMounted && !isAppUser && (
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
