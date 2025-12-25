import React from 'react';
import { usePersonalizedRecommendation } from '@/hooks/usePersonalizedRecommendation';
import { Skeleton } from '@/components/ui/skeleton';
import { ChefHat, Tent, MapPin } from 'lucide-react';

interface RecommendationGridProps {
    onItemClick?: (item: any) => void;
}

export default function RecommendationGrid({ onItemClick }: RecommendationGridProps) {
    const { data, loading } = usePersonalizedRecommendation();

    if (loading) {
        return (
            <div className="px-4 mb-8 grid grid-cols-2 gap-3">
                <Skeleton className="h-32 rounded-2xl" />
                <Skeleton className="h-32 rounded-2xl" />
                <Skeleton className="h-32 rounded-2xl col-span-2" />
            </div>
        );
    }

    const { cooking, play, event } = data;

    // Construct valid items for display
    const items = [];

    // 1. Cooking
    if (cooking) {
        items.push({
            id: `cook-${cooking.id}`,
            icon: <ChefHat className="text-orange-600" size={28} />,
            categoryLabel: '오늘의 셰프',
            title: cooking.title,
            bgColorClass: 'bg-orange-50',
            textColorClass: 'text-orange-600',
            data: cooking
        });
    } else {
        // Fallback Mock
        items.push({
            id: 'cook-mock',
            icon: <ChefHat className="text-stone-400" size={28} />,
            categoryLabel: '오늘의 요리',
            title: '준비 중입니다',
            bgColorClass: 'bg-stone-100',
            textColorClass: 'text-stone-500',
            data: null
        });
    }

    // 2. Play
    if (play) {
        items.push({
            id: `play-${play.id}`,
            icon: <Tent className="text-green-600" size={28} />,
            categoryLabel: '오늘의 놀이',
            title: play.title,
            bgColorClass: 'bg-green-50',
            textColorClass: 'text-green-600',
            data: play
        });
    } else {
        items.push({
            id: 'play-mock',
            icon: <Tent className="text-stone-400" size={28} />,
            categoryLabel: '오늘의 놀이',
            title: '준비 중입니다',
            bgColorClass: 'bg-stone-100',
            textColorClass: 'text-stone-500',
            data: null
        });
    }

    // 3. Event (Wide)
    if (event) {
        items.push({
            id: `event-${event.id}`,
            icon: <MapPin className="text-blue-600" size={28} />,
            categoryLabel: '주변 즐길거리',
            title: event.title,
            bgColorClass: 'bg-blue-50',
            textColorClass: 'text-blue-600',
            isWide: true,
            description: event.location || '가까운 곳에서 즐겨보세요',
            data: event
        });
    } else {
        items.push({
            id: 'event-mock',
            icon: <MapPin className="text-stone-400" size={28} />,
            categoryLabel: '주변 즐길거리',
            title: '진행 중인 행사가 없어요',
            bgColorClass: 'bg-stone-100',
            textColorClass: 'text-stone-500',
            isWide: true,
            description: '새로운 행사를 기다려주세요',
            data: null
        });
    }

    return (
        <section className="px-4 mb-8">
            <div className="flex justify-between items-end mb-4 px-1">
                <h3 className="text-xl font-bold text-[#1C4526] dark:text-[#A7F3D0]">오늘의 추천</h3>
                <span className="text-xs text-stone-500 cursor-pointer hover:underline">더보기</span>
            </div>
            {/* Bento Grid: 2 Top + 1 Bottom Wide */}
            <div className="grid grid-cols-2 gap-3">
                {items.map((item, index) => {
                    // Force the 3rd item to be wide if it is designed that way, 
                    // dependent on standard 3 item array
                    const isWide = index === 2 || item.isWide;
                    return (
                        <div
                            key={item.id}
                            onClick={() => item.data && onItemClick && onItemClick(item.data)}
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
                                    {isWide && item.description && <p className="text-xs text-stone-500 mt-1 line-clamp-1">{item.description}</p>}
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
