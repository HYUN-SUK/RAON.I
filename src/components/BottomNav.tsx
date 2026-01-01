"use client";

import { Home, Calendar, Users, Tent, Shield, ShoppingBag } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";

export default function BottomNav() {
    const pathname = usePathname();

    const tabs = [
        { name: "홈", href: "/", icon: Home },
        { name: "예약", href: "/reservation", icon: Calendar },
        { name: "커뮤니티", href: "/community", icon: Users },
        { name: "내공간", href: "/myspace", icon: Tent },
        { name: "마켓", href: "/market", icon: ShoppingBag },
        { name: "Admin", href: "/admin", icon: Shield },
    ];

    const router = useRouter(); // Actually we need to import useRouter
    const { withAuth } = useRequireAuth(); // Import this

    const handleNavigation = (href: string) => {
        if (href === '/') {
            router.push(href);
            return;
        }
        withAuth(() => router.push(href));
    };

    return (
        <nav className="fixed bottom-0 w-full max-w-[430px] h-[80px] bg-white/90 backdrop-blur-md border-t border-surface-2 flex justify-around items-center z-50 pb-4">
            {tabs.map((tab) => {
                const isActive = pathname === tab.href;
                return (
                    <button
                        key={tab.name}
                        onClick={() => handleNavigation(tab.href)}
                        className={`flex flex-col items-center justify-center w-full h-full gap-1 ${isActive ? "text-brand-1" : "text-text-2"
                            }`}
                    >
                        <tab.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                        <span className="text-[10px] font-medium">{tab.name}</span>
                    </button>
                );
            })}
        </nav>
    );
}
