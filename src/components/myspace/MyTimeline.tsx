"use client";

import React from 'react';
import { useMySpaceStore } from '@/store/useMySpaceStore';
import TimelineCard from './TimelineCard';
import { Calendar } from 'lucide-react';

interface MyTimelineProps {
    isLoading?: boolean;
}

export default function MyTimeline({ isLoading = false }: MyTimelineProps) {
    const { timelineItems } = useMySpaceStore();

    if (isLoading) {
        return (
            <section className="px-6 pb-20 animate-pulse">
                <div className="flex justify-between items-center mb-6">
                    <div className="w-32 h-6 bg-stone-200 dark:bg-stone-800 rounded-md" />
                </div>
                <div className="space-y-4">
                    {[1, 2].map((idx) => (
                        <div key={idx} className="w-full h-[100px] bg-stone-200/30 dark:bg-stone-800/30 rounded-2xl" />
                    ))}
                </div>
            </section>
        );
    }

    return (
        <section className="px-6 pb-20">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#C3A675]" />
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
