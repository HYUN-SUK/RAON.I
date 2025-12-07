import React from 'react';
import { Volume2 } from 'lucide-react';

export default function SlimNotice() {
    return (
        <div className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-t border-stone-100 dark:border-zinc-800 py-3 px-4 flex items-center gap-3">
            <Volume2 className="w-4 h-4 text-[#C3A675] shrink-0" />
            <div className="flex-1 overflow-hidden h-5 relative">
                {/* Simple Marquee effect or single line truncation */}
                <p className="text-xs text-stone-600 dark:text-stone-400 truncate">
                    [공지] 이번 주말 '별보기 좋은 밤' 행사가 진행됩니다. 따뜻한 옷을 챙겨주세요!
                </p>
            </div>
        </div>
    );
}
