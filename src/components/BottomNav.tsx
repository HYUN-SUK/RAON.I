"use client";

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

    const tabs: TabConfig[] = [
        { name: "홈", href: "/", icon: Home, badgeTarget: 'home' },
        { name: "예약", href: "/reservation", icon: Calendar, badgeTarget: 'reservation' },
        { name: "커뮤니티", href: "/community", icon: Users, badgeTarget: 'community' },
        { name: "내 수첩", href: "/myspace", icon: Tent, badgeTarget: 'myspace' },
        { name: "마켓", href: "/market", icon: ShoppingBag },
    ];

    const handleNavigation = (tab: TabConfig) => {
        // 배지가 있으면 페이지 이동 완료 후 안전하게 0.5초 뒤 백그라운드 격리 비동기 실행 (이동 교란 방지)
        if (tab.badgeTarget && badges[tab.badgeTarget] > 0) {
            const target = tab.badgeTarget;
            setTimeout(() => {
                markAsRead(target);
            }, 500);
        }

        if (tab.href === '/') {
            router.push(tab.href);
            return;
        }
        withAuth(() => router.push(tab.href));
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
        <nav className="fixed bottom-0 w-full max-w-[430px] h-[80px] bg-white border-t border-stone-200/70 flex justify-around items-center z-50 pb-3">
            {tabs.map((tab) => {
                const isActive = pathname === tab.href;
                const badgeCount = getBadgeCount(tab.badgeTarget);
                const hasBadge = badgeCount > 0;

                return (
                    <button
                        key={tab.name}
                        onClick={() => handleNavigation(tab)}
                        className={`relative flex flex-col items-center justify-center w-full h-full gap-1 rounded-xl transition-all duration-100 active:scale-95 ${
                            isActive ? "text-[#388E5A]" : "text-stone-800 dark:text-stone-200"
                        }`}
                    >
                        {/* 아이콘 + 초록색 New 배지 */}
                        <div className="relative flex items-center justify-center">
                            <tab.icon size={24} strokeWidth={isActive ? 2.5 : 1.8} className={isActive ? "text-[#388E5A]" : "text-stone-800 dark:text-stone-200"} />
                            {hasBadge && (
                                <span className="absolute -top-2.5 -right-3.5 bg-[#388E5A] text-white text-[9.5px] font-black px-1.5 py-[0.5px] rounded-full leading-tight shadow-xs scale-90">
                                    New
                                </span>
                            )}
                        </div>
                        <span className={`text-[11px] ${isActive ? "font-bold text-[#388E5A]" : "font-semibold text-stone-700 dark:text-stone-300"}`}>
                            {tab.name}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
}
