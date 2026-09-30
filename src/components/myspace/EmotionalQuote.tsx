"use client";

import React from 'react';
import { useMySpaceQuote } from '@/hooks/useMySpaceQuote';

interface EmotionalQuoteProps {
    familyType?: string;
}

export default function EmotionalQuote({ familyType }: EmotionalQuoteProps) {
    const { quote, context, weather } = useMySpaceQuote({ familyType });

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
        <div className="mx-6 my-2">
            <div className="relative bg-[#FFF9EE] rounded-3xl p-5 border border-[#FBE3B5] shadow-xs overflow-hidden text-center">

                {/* Dog-ear (종이 접힘) 효과 - 오른쪽 상단 */}
                <div
                    className="absolute top-0 right-0 w-8 h-8 pointer-events-none"
                    style={{
                        background: 'linear-gradient(135deg, transparent 50%, #F5D7A1 50%, #E8C382 100%)',
                        borderBottomLeftRadius: '8px',
                    }}
                />
                <div
                    className="absolute top-0 right-0 w-8 h-8 pointer-events-none"
                    style={{
                        background: 'linear-gradient(135deg, #FFF9EE 50%, transparent 50%)',
                        boxShadow: '-1px 1px 2px rgba(0,0,0,0.04)',
                    }}
                />

                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5 pointer-events-none">
                    <div className="absolute top-2 right-12 text-6xl">{getContextEmoji()}</div>
                </div>

                {/* Quote Content */}
                <div className="relative z-10 px-2 py-1">
                    <p className="text-sm text-[#8C632B] italic font-serif leading-relaxed">
                        &ldquo;{quote}&rdquo;
                    </p>
                </div>
            </div>
        </div>
    );
}

