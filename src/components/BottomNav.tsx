"use client";

import Link from "next/link";
import { Home, Calendar, Users, Tent, Shield } from "lucide-react";
import { usePathname } from "next/navigation";

export default function BottomNav() {
    const pathname = usePathname();

    const tabs = [
        { name: "홈", href: "/", icon: Home },
        { name: "예약", href: "/reservation", icon: Calendar },
        { name: "커뮤니티", href: "/community", icon: Users },
        { name: "내공간", href: "/myspace", icon: Tent },
        { name: "Admin", href: "/admin", icon: Shield },
    ];

    return (
        <nav className="fixed bottom-0 w-full max-w-[430px] h-[80px] bg-white/90 backdrop-blur-md border-t border-surface-2 flex justify-around items-center z-50 pb-4">
            {tabs.map((tab) => {
                const isActive = pathname === tab.href;
                return (
                    <Link
                        key={tab.name}
                        href={tab.href}
                        className={`flex flex-col items-center justify-center w-full h-full gap-1 ${isActive ? "text-brand-1" : "text-text-2"
                            }`}
                    >
                        <tab.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                        <span className="text-[10px] font-medium">{tab.name}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
