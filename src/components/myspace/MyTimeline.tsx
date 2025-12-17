"use client";

import { useEffect } from 'react';
import { useMySpaceStore } from '@/store/useMySpaceStore';
import TimelineCard from './TimelineCard';
import { Calendar } from 'lucide-react';

export default function MyTimeline() {
    const { timelineItems, fetchTimeline } = useMySpaceStore();

    useEffect(() => {
        // Fetch data on mount (Mock)
        if (timelineItems.length === 0) {
            fetchTimeline();
        }
    }, [fetchTimeline, timelineItems.length]);

    return (
        <section className="px-6 pb-20">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#C3A675]" />
                    나의 캠핑 로그
                </h3>
            </div>

            {/* AI Summary Placeholder for Phase 4 */}
            <div className="mb-8 p-4 bg-gradient-to-r from-[#F7F5EF] to-white dark:from-zinc-900 dark:to-zinc-800 rounded-2xl border border-stone-200 dark:border-zinc-700 shadow-sm">
                <p className="text-sm text-stone-600 dark:text-stone-300 italic">
                    "최근 <span className="font-bold text-[#1C4526] dark:text-green-400">3번의 캠핑</span>에서 불멍을 가장 즐기셨네요!
                    다음엔 별보기 좋은 <span className="font-bold text-[#1C4526] dark:text-green-400">명당 사이트</span>를 추천해드릴까요?"
                </p>
                <p className="text-xs text-stone-400 mt-2 text-right">- RAON AI Analysis</p>
            </div>

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
