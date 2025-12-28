"use client";

import { Megaphone } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SlimNotice() {
    const router = useRouter();

    return (
        <div className="px-6 pb-4">
            <div
                onClick={() => router.push('/community?tab=NOTICE')}
                className="glass-panel flex items-center gap-3 px-5 py-3 rounded-2xl cursor-pointer hover:bg-white/90 active:scale-95 transition-all duration-200"
            >
                <div className="p-1.5 bg-brand-1/10 rounded-full">
                    <Megaphone size={14} className="text-brand-1" fill="currentColor" />
                </div>
                <span className="text-xs font-medium text-text-1 truncate tracking-tight">
                    <span className="font-bold text-brand-1 mr-1">공지</span>
                    [시스템] 서버 점검 안내 (12/01 02:00~)
                </span>
            </div>
        </div>
    );
}
