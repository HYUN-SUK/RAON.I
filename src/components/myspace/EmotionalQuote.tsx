"use client";

import React from 'react';
import { useMySpaceQuote } from '@/hooks/useMySpaceQuote';

export default function EmotionalQuote() {
    const { quote, context, weather } = useMySpaceQuote();

    // 날씨/시간에 따른 배경 아이콘 - 기록/수첩 테마
    const getContextEmoji = () => {
        if (weather.type === 'rainy') return '📝';
        if (weather.type === 'snowy') return '📖';
        if (context.time === 'night') return '🌙';
        if (context.time === 'dawn') return '✍️';
        if (context.time === 'evening') return '📓';
        if (context.season === 'spring') return '🌸';
        if (context.season === 'summer') return '📔';
        if (context.season === 'autumn') return '🍂';
        if (context.season === 'winter') return '📕';
        return '📖';
    };

    return (
        <div className="mx-4 my-4">
            <div className="relative bg-gradient-to-br from-[#F7F5EF] to-[#ECE8DF] dark:from-zinc-800 dark:to-zinc-900 rounded-2xl p-5 border border-stone-200/50 dark:border-zinc-700/50 shadow-sm overflow-hidden">

                {/* Dog-ear (종이 접힘) 효과 - 오른쪽 상단 */}
                <div
                    className="absolute top-0 right-0 w-8 h-8 pointer-events-none"
                    style={{
                        background: 'linear-gradient(135deg, transparent 50%, #E8E4DB 50%, #DDD8CF 100%)',
                        borderBottomLeftRadius: '8px',
                    }}
                />
                <div
                    className="absolute top-0 right-0 w-8 h-8 pointer-events-none"
                    style={{
                        background: 'linear-gradient(135deg, #F7F5EF 50%, transparent 50%)',
                        boxShadow: '-1px 1px 2px rgba(0,0,0,0.05)',
                    }}
                />

                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5 pointer-events-none">
                    <div className="absolute top-2 right-12 text-6xl">{getContextEmoji()}</div>
                </div>

                {/* Quote Content */}
                <div className="relative z-10">
                    <p className="text-sm text-stone-600 dark:text-stone-300 italic font-serif leading-relaxed">
                        &ldquo;{quote}&rdquo;
                    </p>
                </div>

                {/* Subtle Accent Line */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#C3A675]/30 to-transparent" />
            </div>
        </div>
    );
}

