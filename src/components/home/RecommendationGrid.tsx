import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ChefHat, Tent, MapPin, Clock } from 'lucide-react';
import { usePersonalizedRecommendation } from '@/hooks/usePersonalizedRecommendation'; // Keep for type if exported, or just use ReturnType
import { Database } from '@/types/supabase';

type RecommendationItem = Database['public']['Tables']['recommendation_pool']['Row'];
type NearbyEvent = Database['public']['Tables']['nearby_events']['Row'];

type PersonalizedData = ReturnType<typeof usePersonalizedRecommendation>['data'];

interface DetailedRecommendationItem {
    id: string;
    icon: React.ReactNode;
    categoryLabel: string;
    title: string;
    bgColorClass: string;
    textColorClass: string;
    isWide?: boolean;
    description?: string | null;
    data: RecommendationItem | { type: 'nearby_lbs', events: NearbyEvent[] } | null;
    reason?: string;
}

interface RecommendationGridProps {
    data: PersonalizedData;
    loading: boolean;
    onItemClick?: (item: RecommendationItem | { type: 'nearby_lbs', events: NearbyEvent[] }, reason?: string) => void;
}

export default function RecommendationGrid({ data, loading, onItemClick }: RecommendationGridProps) {
    if (loading) {
        return (
            <div className="px-4 mb-8 grid grid-cols-2 gap-3">
                <Skeleton className="h-32 rounded-2xl" />
                <Skeleton className="h-32 rounded-2xl" />
                <Skeleton className="h-32 rounded-2xl col-span-2" />
            </div>
        );
    }

    const { cooking, play, events, reasons } = data;

    // Construct valid items for display
    const items = [];

    // 1. Cooking
    if (cooking) {
        items.push({
            id: `cook-${cooking.id}`,
            icon: <ChefHat className="text-orange-600" size={28} />,
            categoryLabel: '오늘의 셰프',
            title: cooking.title,
            bgColorClass: 'bg-[#FDFBF7]',
            textColorClass: 'text-amber-900',
            data: cooking,
            reason: reasons?.cooking
        });
    } else {
        // Fallback Mock
        items.push({
            id: 'cook-mock',
            icon: <ChefHat className="text-stone-400" size={28} />,
            categoryLabel: '오늘의 요리',
            title: '준비 중입니다',
            bgColorClass: 'bg-[#FDFBF7]',
            textColorClass: 'text-stone-400',
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
            bgColorClass: 'bg-[#F1F8E9]',
            textColorClass: 'text-[#1C4526]',
            data: play,
            reason: reasons?.play
        });
    } else {
        items.push({
            id: 'play-mock',
            icon: <Tent className="text-stone-400" size={28} />,
            categoryLabel: '오늘의 놀이',
            title: '준비 중입니다',
            bgColorClass: 'bg-[#F1F8E9]',
            textColorClass: 'text-stone-400',
            data: null
        });
    }

    // 3. Events (Nearby LBS)
    const eventCount = events ? events.length : 0;
    const firstEvent = events && events.length > 0 ? events[0] : null;

    if (eventCount > 0 && firstEvent) {
        items.push({
            id: `event-lbs`,
            icon: <MapPin className="text-sky-600" size={28} />,
            categoryLabel: '주변 레포츠, 관광지, 편의시설, 행사',
            title: firstEvent.title,
            bgColorClass: 'bg-[#E3F2FD]',
            textColorClass: 'text-[#1E3A8A]',
            isWide: true,
            description: eventCount > 1
                ? `외 ${eventCount - 1}개의 행사와 편의시설이 있어요`
                : firstEvent.location || '가까운 곳에서 즐겨보세요',
            data: { type: 'nearby_lbs' as const, events: events } // Special type for LBS handler
        });
    } else {
        items.push({
            id: 'event-mock',
            icon: <MapPin className="text-sky-600" size={28} />,
            categoryLabel: '주변 레포츠, 관광지, 편의시설, 행사',
            title: '주변의 숨은 명소와 액티비티',
            bgColorClass: 'bg-[#E3F2FD]',
            textColorClass: 'text-slate-500',
            isWide: true,
            description: '레포츠, 관광지, 편의시설을 확인해보세요',
            data: { type: 'nearby_lbs' as const, events: [] }
        });
    }

    return (
        <section className="px-4 mb-8">
            <div className="flex justify-between items-end mb-4 px-1">
                <h3 className="text-xl font-bold text-[#1C4526] dark:text-[#A7F3D0]">오늘의 추천</h3>
            </div>
            {/* Bento Grid: 2 Top + 1 Bottom Wide */}
            <div className="grid grid-cols-2 gap-3">
                {items.map((item, index) => {
                    // Force the 3rd item to be wide if it is designed that way, 
                    // dependent on standard 3 item array
                    const isWide = index === 2 || item.isWide;

                    // Safe access to potential V2 properties
                    // We know the structure based on DB schema now but for now we cast to specific known interface or use optional chaining safely without any
                    const dataV2 = item.data as (RecommendationItem & { difficulty?: number, time_required?: number, calories?: number });
                    const hasV2Info = dataV2 && (dataV2.difficulty || dataV2.time_required || dataV2.calories);

                    return (
                        <div
                            key={item.id}
                            onClick={() => item.data && onItemClick && onItemClick(item.data, item.reason)}
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
                                    <p className={`text-responsive-badge ${item.textColorClass} font-bold mb-1`}>{item.categoryLabel}</p>
                                    <h4 className={`${isWide ? 'text-responsive-card-title' : 'text-responsive-chip-label'} font-bold text-stone-800 dark:text-stone-100 leading-tight`}>
                                        {item.title}
                                    </h4>

                                    {/* V2 Badges: Difficulty & Time */}
                                    {hasV2Info && (
                                        <div className="flex gap-1 mt-2 flex-nowrap overflow-hidden">
                                            {dataV2.difficulty && (
                                                <span className="inline-flex items-center text-responsive-badge text-stone-500 bg-white/50 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                                                    {'⭐'.repeat(dataV2.difficulty)}
                                                </span>
                                            )}
                                            {dataV2.time_required && (
                                                <span className="inline-flex items-center text-responsive-badge text-stone-500 bg-white/50 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                                                    <Clock size={10} className="mr-0.5 flex-shrink-0" />
                                                    {dataV2.time_required}분
                                                </span>
                                            )}
                                            {dataV2.calories && (
                                                <span className="inline-flex items-center text-responsive-badge text-orange-600 bg-orange-50/80 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                                                    {dataV2.calories}kcal
                                                </span>
                                            )}
                                        </div>
                                    )}

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
