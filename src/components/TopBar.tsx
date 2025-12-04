"use client";

import { Settings } from "lucide-react";

import { useMySpaceStore } from "@/store/useMySpaceStore";

export default function TopBar() {
    const { level, xp } = useMySpaceStore();
    // Simple XP logic: 100 XP per level. Current progress is xp % 100.
    const progress = (xp % 100);

    return (
        <header className="relative z-50 flex justify-between items-center px-6 h-[60px] bg-white">
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

            {/* Settings Icon */}
            <button className="p-2 -mr-2 rounded-full hover:bg-surface-1 transition-colors text-text-1">
                <Settings size={22} strokeWidth={1.5} />
            </button>
        </header>
    );
}
