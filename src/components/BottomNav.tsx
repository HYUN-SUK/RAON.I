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
        <nav className="fixed bottom-0 w-full max-w-[430px] h-[80px] bg-white/90 backdrop-blur-md border-t border-surface-2 flex justify-around items-center z-50 pb-4">

            {tabs.map((tab) => {
                const isActive = pathname === tab.href;
                const badgeCount = getBadgeCount(tab.badgeTarget);
                const hasBadge = badgeCount > 0;

                return (
                    <button
                        key={tab.name}
                        onClick={() => handleNavigation(tab)}
                        className={`relative flex flex-col items-center justify-center w-full h-full gap-1 rounded-xl transition-all duration-100 active:bg-black/10 active:scale-95 ${isActive ? "text-brand-1" : "text-text-2"
                            }`}
                    >
                        {/* 아이콘 + 배지 */}
                        <div className="relative">
                            <tab.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                            {/* 빨간 dot 배지 */}
                            {hasBadge && (
                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                            )}
                        </div>
                        <span className="text-[10px] font-medium">{tab.name}</span>
                    </button>
                );
            })}
        </nav>
    );
}
