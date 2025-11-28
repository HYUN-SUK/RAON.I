"use client";

import { PenTool, Camera } from "lucide-react";

export default function ActionButtons() {
    return (
        <div className="grid grid-cols-2 gap-4 px-6 py-6 -mt-8 relative z-20">
            <button className="flex items-center justify-center gap-2.5 bg-gradient-to-br from-[#1C4526] to-[#2D5A3A] text-white py-4 rounded-2xl shadow-lg shadow-brand-1/25 hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all duration-300 w-full">
                <PenTool size={18} strokeWidth={2.5} />
                <span className="font-bold text-[15px] tracking-tight">이야기 올리기</span>
            </button>
            <button className="flex items-center justify-center gap-2.5 bg-white text-text-1 border border-surface-2 py-4 px-6 rounded-2xl shadow-soft hover:bg-surface-1 hover:border-surface-2 hover:shadow-medium active:scale-95 transition-all duration-300 w-full">
                <Camera size={18} strokeWidth={2.5} />
                <span className="font-bold text-[15px] tracking-tight">사진</span>
            </button>
        </div>
    );
}
