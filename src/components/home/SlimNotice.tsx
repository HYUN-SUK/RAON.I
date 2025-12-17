import React from 'react';
import { Volume2 } from 'lucide-react';
import { useRouter } from "next/navigation";

export default function SlimNotice() {
    const router = useRouter();

    return (
        <div
            onClick={() => router.push('/community')}
            className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-t border-stone-100 dark:border-zinc-800 py-3 px-4 flex items-center gap-3 cursor-pointer active:bg-stone-50 dark:active:bg-zinc-800 transition-colors"
        >
            <Volume2 className="w-4 h-4 text-[#C3A675] shrink-0" />
            <div className="flex-1 overflow-hidden h-5 relative">
                {/* Simple Marquee effect or single line truncation */}
                <p className="text-xs text-stone-600 dark:text-stone-400 truncate">
                    &apos;RAON.I&apos;가 처음이신가요? 🏕️주말 &apos;별보기 좋은 밤&apos; 행사가 진행됩니다. 따뜻한 옷을 챙겨주세요!
                </p>
            </div>
        </div>
    );
}
