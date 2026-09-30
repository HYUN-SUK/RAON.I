"use client";

import React from 'react';
import { useMySpaceStore } from '@/store/useMySpaceStore';
import TimelineCard from './TimelineCard';
import { Calendar, Loader2 } from 'lucide-react';

interface MyTimelineProps {
    isLoading?: boolean;
}

export default function MyTimeline({ isLoading = false }: MyTimelineProps) {
    const { timelineItems, isTimelineLoading } = useMySpaceStore();
    const effectiveLoading = isLoading || isTimelineLoading;

    if (effectiveLoading) {
        return (
            <section className="px-6 pb-20">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-[#C3A675]" />
                        나의 캠핑 로그
                    </h3>
                </div>
                {/* ⛺ 로딩 안내 문구 & 스켈레톤 */}
                <div className="bg-amber-50/70 dark:bg-stone-800/60 border border-amber-200/60 dark:border-amber-800/40 rounded-2xl p-4 mb-4 flex items-center gap-3 shadow-xs">
                    <Loader2 className="w-5 h-5 text-amber-600 dark:text-amber-400 animate-spin shrink-0" />
                    <p className="text-xs sm:text-sm font-bold text-stone-700 dark:text-stone-200">
                        ⛺ 나의 소중한 캠핑 기록을 불러오는 중입니다...
                    </p>
                </div>
                <div className="space-y-4 animate-pulse">
                    {[1, 2].map((idx) => (
                        <div key={idx} className="w-full h-[100px] bg-stone-200/50 dark:bg-stone-800/50 rounded-2xl border border-stone-200/30 dark:border-stone-700/30" />
                    ))}
                </div>
            </section>
        );
    }

    return (
        <section className="px-6 pb-20">
            <div className="flex justify-between items-center mb-5">
                <h3 className="text-lg font-black text-[#1E4D2B] flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#2E7D47]" />
                    나의 캠핑 로그
                </h3>
            </div>

            {/* AI 개인화 분석은 추후 구현 예정 */}

            <div className="flex flex-col">
                {timelineItems.length > 0 ? (
                    <>
                        {timelineItems.slice(0, 3).map((item) => (
                            <TimelineCard key={item.id} item={item} />
                        ))}
                        <p className="text-center py-4 text-stone-400 text-sm">"이곳에는 당신의 캠핑 이야기가 차곡차곡 쌓이게 됩니다."</p>
                    </>
                ) : (
                    <div className="text-center py-10 text-stone-400">
                        <p>아직 기록된 활동이 없어요.</p>
                    </div>
                )}
            </div>
        </section>
    );
}
