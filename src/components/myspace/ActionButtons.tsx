"use client";

import { useRouter } from 'next/navigation';
import { PenTool, Camera, Book } from "lucide-react";

export default function ActionButtons() {
    const router = useRouter();

    return (
        <div className="grid grid-cols-2 gap-4 px-6 py-6 -mt-8 relative z-20">
            {/* Primary Action: Write Log */}
            <button
                onClick={() => router.push('/community/write?type=STORY')}
                className="flex items-center justify-center gap-2.5 bg-brand-1 text-white py-4 rounded-2xl shadow-lg shadow-brand-1/25 hover:bg-brand-2 hover:scale-[1.02] active:scale-95 transition-all duration-300 w-full"
            >
                <PenTool size={18} strokeWidth={2.5} />
                <span className="font-bold text-[15px] tracking-tight">기록 남기기</span>
            </button>

            {/* Secondary Action: View My Records */}
            <button
                onClick={() => router.push('/myspace/records')}
                className="flex items-center justify-center gap-2.5 bg-white text-text-1 border border-surface-2 py-4 px-6 rounded-2xl shadow-soft hover:bg-surface-1 hover:border-surface-2 hover:shadow-medium active:scale-95 transition-all duration-300 w-full"
            >
                <Book size={18} strokeWidth={2.5} />
                <span className="font-bold text-[15px] tracking-tight">내 기록 보기</span>
            </button>
        </div>
    );
}
