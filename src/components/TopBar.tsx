"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { LogOut, LogIn, Settings, User, Bell, FileText } from "lucide-react";
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

export default function TopBar() {
    const { level, xp, raonToken, setWallet } = useMySpaceStore();
    const router = useRouter();
    const supabase = createClient();
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    // Dynamic Level Progress
    const { progress } = getLevelInfo(xp);

    useEffect(() => {
        checkUser();
    }, []);

    const checkUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        setIsLoggedIn(!!session);

        if (user) {
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
            } catch (error) {
                console.error("Login reward/sync failed:", error);
            }
        }
    };

    const handleLogin = () => {
        router.push('/login');
    };

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
            toast.success('로그아웃 되었습니다.');
            setIsLoggedIn(false);
            router.push('/'); // Redirect to home
        } catch (error) {
            console.error('Logout error:', error);
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

            {/* Auth Action Icon */}
            {isLoggedIn ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            className="relative z-[101] p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors text-text-1 cursor-pointer outline-none"
                            aria-label="Settings"
                        >
                            <Settings size={22} strokeWidth={1.5} />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-white">
                        <DropdownMenuLabel>내 계정</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => router.push('/myspace')} className="cursor-pointer">
                            <User className="mr-2 h-4 w-4" />
                            <span>프로필</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer">
                            <Bell className="mr-2 h-4 w-4" />
                            <span>알림 설정</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer">
                            <FileText className="mr-2 h-4 w-4" />
                            <span>이용 약관</span>
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
                    className="relative z-[101] p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors text-text-1 cursor-pointer"
                    aria-label="Login"
                >
                    <LogIn size={22} strokeWidth={1.5} />
                </button>
            )}
        </header>
    );
}
