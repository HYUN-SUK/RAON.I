"use client";

import { useState, useEffect } from "react";
import { Home, Calendar, Users, Tent, ShoppingBag } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useInAppBadge } from "@/hooks/useInAppBadge";

// 탭과 배지 타겟 매핑
type BadgeTarget = 'home' | 'reservation' | 'community' | 'myspace';

interface TabConfig {
    name: string;
    href: string;
    icon: typeof Home;
    badgeTarget?: BadgeTarget;
}

export default function BottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { withAuth } = useRequireAuth();
    const { badges, markAsRead } = useInAppBadge();

    // 0ms 낙관적 즉각 활성화 상태 (터치 즉시 반응)
    const [activeTab, setActiveTab] = useState<string>(pathname);

    // 실제 URL 경로와 동기화 (뒤로가기, 외부 링크 등 대응)
    useEffect(() => {
        setActiveTab(pathname);
    }, [pathname]);

    const tabs: TabConfig[] = [
        { name: "홈", href: "/", icon: Home, badgeTarget: 'home' },
        { name: "예약", href: "/reservation", icon: Calendar, badgeTarget: 'reservation' },
        { name: "커뮤니티", href: "/community", icon: Users, badgeTarget: 'community' },
        { name: "내 수첩", href: "/myspace", icon: Tent, badgeTarget: 'myspace' },
        { name: "마켓", href: "/market", icon: ShoppingBag },
    ];

    // 가벼운 웹 진동 (지원 기기에서 조용히 작동)
    const triggerLightHaptic = () => {
        try {
            if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate(10);
            }
        } catch {}
    };

    const handleNavigation = (tab: TabConfig) => {
        // 이미 현재 머물고 있는 탭인 경우 중복 이동 차단
        if (activeTab === tab.href && pathname === tab.href) {
            return;
        }

        // 즉시 가벼운 터치 햅틱 시도
        triggerLightHaptic();

        // 배지가 있으면 페이지 이동 완료 후 안전하게 0.5초 뒤 백그라운드 격리 비동기 실행 (이동 교란 방지)
        if (tab.badgeTarget && badges[tab.badgeTarget] > 0) {
            const target = tab.badgeTarget;
            setTimeout(() => {
                markAsRead(target);
            }, 500);
        }

        if (tab.href === '/') {
            // 0ms 즉시 초록색 불 켜기
            setActiveTab(tab.href);
            router.push(tab.href);
            return;
        }

        // 로그인이 허용된 경우에만 즉시 탭 불 켜고 이동
        withAuth(() => {
            setActiveTab(tab.href);
            router.push(tab.href);
        });
    };

    // 배지 개수 가져오기
    const getBadgeCount = (target?: BadgeTarget): number => {
        if (!target) return 0;
        return badges[target] || 0;
    };

    // 팩트체크/의견수집 화면(/verify)에서는 하단 탭 메뉴 숨김 (전용 액션 바 공간 확보)
    if (pathname.startsWith('/verify')) {
        return null;
    }

    return (
        <nav 
            style={{ backgroundColor: '#ffffff' }}
            className="fixed bottom-0 w-full max-w-[430px] min-h-[80px] h-[calc(80px+var(--sab,0px))] bg-white dark:bg-zinc-900 border-t border-[#EAEFEA] dark:border-zinc-800 flex justify-around items-center z-50 pb-[calc(0.75rem+var(--sab,0px))] select-none"
        >
            {tabs.map((tab) => {
                const isActive = activeTab === tab.href;
                const badgeCount = getBadgeCount(tab.badgeTarget);
                const hasBadge = badgeCount > 0;

                return (
                    <button
                        key={tab.name}
                        onClick={() => handleNavigation(tab)}
                        className="relative flex flex-col items-center justify-center w-full h-full gap-0.5 rounded-xl transition-all duration-150 active:scale-90 cursor-pointer"
                    >
                        {/* 캡슐 알약(Pill Capsule) 아이콘 컨테이너 */}
                        <div className={`relative flex items-center justify-center px-3.5 py-1 rounded-full transition-all duration-200 ${
                            isActive 
                                ? "bg-[#2E7D47]/12 text-[#2E7D47] scale-105" 
                                : "bg-transparent text-[#7A8B7E]"
                        }`}>
                            <tab.icon 
                                size={22} 
                                strokeWidth={isActive ? 2.5 : 1.8} 
                                className={`transition-transform duration-200 ${
                                    isActive ? "scale-105 text-[#2E7D47]" : "text-[#7A8B7E]"
                                }`} 
                            />
                            {hasBadge && (
                                <span className="absolute -top-1 -right-1 bg-[#2E7D47] text-white text-[9.5px] font-black px-1.5 py-[0.5px] rounded-full leading-tight shadow-2xs scale-90">
                                    New
                                </span>
                            )}
                        </div>

                        {/* 탭 명칭 텍스트 */}
                        <span className={`text-[11px] transition-all duration-150 tracking-tight ${
                            isActive 
                                ? "font-black text-[#2E7D47] scale-[1.02]" 
                                : "font-semibold text-[#7A8B7E]"
                        }`}>
                            {tab.name}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
}
