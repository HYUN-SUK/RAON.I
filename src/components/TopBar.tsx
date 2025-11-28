"use client";

import { Settings } from "lucide-react";

export default function TopBar() {
    return (
        <header className="relative z-50 flex justify-between items-center px-6 h-[60px] bg-white">
            {/* Left Spacer for centering */}
            <div className="w-[22px]" />

            {/* Logo - Centered, Simple Font */}
            <h1 className="text-lg font-bold text-text-1 tracking-widest font-sans">
                RAON.I
            </h1>

            {/* Settings Icon */}
            <button className="p-2 -mr-2 rounded-full hover:bg-surface-1 transition-colors text-text-1">
                <Settings size={22} strokeWidth={1.5} />
            </button>
        </header>
    );
}
