import React, { useEffect } from 'react';
import { useRecommendationStore } from '@/store/useRecommendationStore';

interface RecommendationGridProps {
    onItemClick?: (item: any) => void;
}

export default function RecommendationGrid({ onItemClick }: RecommendationGridProps) {
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
            {/* Bento Grid: 2 Top + 1 Bottom Wide */}
            <div className="grid grid-cols-2 gap-3">
                {currentRecommendations.map((item, index) => {
                    // Index 2 is the 'Wide' bottom item
                    const isWide = index === 2;
                    return (
                        <div
                            key={item.id}
                            onClick={() => onItemClick && onItemClick(item)}
                            className={`
                                ${item.bgColorClass} 
                                ${isWide ? 'col-span-2 flex-row items-center px-6' : 'col-span-1 flex-col items-start p-4'} 
                                rounded-2xl flex justify-between h-32 
                                transition-transform active:scale-95 cursor-pointer relative overflow-hidden group
                            `}
                        >
                            {/* Decorative Blur for Wide Card */}
                            {isWide && (
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                            )}

                            <div className={`flex ${isWide ? 'flex-row items-center gap-4' : 'flex-col justify-between h-full'}`}>
                                <span className={`${isWide ? 'text-4xl bg-white/30 p-3 rounded-full' : 'text-3xl'}`}>
                                    {item.icon}
                                </span>
                                <div>
                                    <p className={`text-xs ${item.textColorClass} font-bold mb-1`}>{item.categoryLabel}</p>
                                    <h4 className={`${isWide ? 'text-lg' : 'text-sm'} font-bold text-stone-800 dark:text-stone-100 leading-tight`}>
                                        {item.title}
                                    </h4>
                                    {isWide && <p className="text-xs text-stone-500 mt-1 line-clamp-1">가족과 함께 즐기는 특별한 시간</p>}
                                </div>
                            </div>

                            {/* Arrow for Wide Card */}
                            {isWide && (
                                <div className="bg-white/40 p-2 rounded-full">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="m9 18 6-6-6-6" /></svg>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
