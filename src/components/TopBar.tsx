"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { LogOut, LogIn, Settings, User, Bell, FileText } from "lucide-react";
import { toast } from "sonner";
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
    const { level, xp } = useMySpaceStore();
    const router = useRouter();
    const supabase = createClient();
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    // Simple XP logic: 100 XP per level. Current progress is xp % 100.
    const progress = (xp % 100);

    useEffect(() => {
        checkUser();
    }, []);

    const checkUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        setIsLoggedIn(!!session);
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
            <div className="flex items-center gap-3">
                <div className="bg-black text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                    Lv.{level}
                </div>
                <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-green-600 transition-all duration-500 rounded-full"
                        style={{ width: `${progress}%` }}
                    />
                </div>
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
