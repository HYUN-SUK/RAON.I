import React, { useEffect } from 'react';
import { useRecommendationStore } from '@/store/useRecommendationStore';

export default function RecommendationGrid() {
    const { currentRecommendations, updateContext } = useRecommendationStore();

    // Initial Load - Set Context based on real time (Default sunny for now)
    useEffect(() => {
        updateContext(new Date().getHours(), 'sunny');
        // In a real app, we would fetch weather here.
    }, [updateContext]);

    // Fallback if empty (should haven't happen with defaults, but safe guard)
    if (!currentRecommendations || currentRecommendations.length === 0) return null;

    return (
        <section className="px-4 mb-8">
            <div className="flex justify-between items-end mb-4 px-1">
                <h3 className="text-xl font-bold text-[#1C4526] dark:text-[#A7F3D0]">오늘의 추천</h3>
                <span className="text-xs text-stone-500 cursor-pointer hover:underline">더보기</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
                {currentRecommendations.map((item) => (
                    <div
                        key={item.id}
                        className={`${item.bgColorClass} p-4 rounded-2xl flex flex-col justify-between h-32 transition-transform active:scale-95 cursor-pointer`}
                    >
                        <span className="text-2xl">{item.icon}</span>
                        <div>
                            <p className={`text-xs ${item.textColorClass} font-bold mb-1`}>{item.categoryLabel}</p>
                            <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">{item.title}</p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
