"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase-client";
import { LogOut, LogIn, Settings, User, Bell, FileText, Download } from "lucide-react";
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

import { useMySpaceStore } from "@/store/useMySpaceStore";
import { usePushNotification } from "@/hooks/usePushNotification";
import { usePWAInstallPrompt } from "@/hooks/usePWAInstallPrompt";
import { usePermissionFlow } from "@/hooks/usePermissionFlow";
import PWAInstallGuideModal from "@/components/pwa/PWAInstallGuideModal";
import LocationPermissionPrompt from "@/components/permission/LocationPermissionPrompt";
import PushPermissionPrompt from "@/components/permission/PushPermissionPrompt";
import IOSPWAGuidePrompt from "@/components/permission/IOSPWAGuidePrompt";

interface UserInfo {
    nickname: string;
    avatarUrl?: string;
}

export default function TopBar() {
    const { level, xp, raonToken, setWallet, reset } = useMySpaceStore();
    const router = useRouter();
    const { requestPermission } = usePushNotification();
    const supabase = createClient();
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

    // PWA
    const { isInstallable, promptInstall, platform } = usePWAInstallPrompt();
    const [isIOSModalOpen, setIsIOSModalOpen] = useState(false);

    // Permission Flow
    const {
        showLocationPrompt,
        showPushPrompt,
        showIOSPWAPrompt,
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
            // reset(); // Optional: Reset on initial load if no session? Maybe risky if persisting layout prefs.
        }
    };

    useEffect(() => {
        checkUser();

        // 실시간 세션 변경 감지 리스너 구독
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setIsLoggedIn(!!session);
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
                checkUser();
            } else if (event === 'SIGNED_OUT') {
                setUserInfo(null);
                reset();
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
            await supabase.auth.signOut();
            toast.success('로그아웃 되었습니다.');
            setIsLoggedIn(false);
            setUserInfo(null);
            reset(); // Reset global store state
            router.push('/'); // Redirect to home
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const handleInstallClick = async () => {
        const result = await promptInstall();
        // If result is NOT 'accepted' or 'dismissed', it means native prompt wasn't available
        // So we show the manual guide modal (which uses the 'platform' return value)
        if (result !== 'accepted' && result !== 'dismissed') {
            setIsIOSModalOpen(true); // Reusing this state name for generic modal open functionality
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

            {/* Right Side: Install + Auth */}
            <div className="flex items-center gap-2 -mr-2">

                {/* PWA Install Button (Visible only if installable) */}
                {isInstallable && (
                    <button
                        onClick={handleInstallClick}
                        className="flex items-center gap-1 py-1.5 px-2.5 rounded-full bg-stone-100/80 hover:bg-stone-200 transition-colors text-stone-600"
                        title="홈 화면에 추가"
                    >
                        <Download size={16} strokeWidth={2} />
                        <span className="text-xs font-bold hidden sm:inline">앱 설치</span>
                    </button>
                )}

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
                        <DropdownMenuContent align="end" className="w-48 bg-white">
                            <DropdownMenuLabel>
                                {userInfo?.nickname || '내 계정'}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => router.push('/myspace')} className="cursor-pointer">
                                <User className="mr-2 h-4 w-4" />
                                <span>프로필 / 내 공간</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => requestPermission(true)} className="cursor-pointer">
                                <Bell className="mr-2 h-4 w-4" />
                                <span>알림 설정 / 권한 허용</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push('/terms')} className="cursor-pointer">
                                <FileText className="mr-2 h-4 w-4" />
                                <span>이용 약관</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push('/privacy-policy')} className="cursor-pointer">
                                <FileText className="mr-2 h-4 w-4" />
                                <span>개인정보처리방침</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push('/myspace/settings/withdraw')} className="cursor-pointer text-stone-500">
                                <Settings className="mr-2 h-4 w-4" />
                                <span>회원 탈퇴</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 cursor-pointer">
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
            </div>

            <PWAInstallGuideModal
                isOpen={isIOSModalOpen}
                onClose={() => setIsIOSModalOpen(false)}
                platform={platform} // Pass detected platform
            />

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
