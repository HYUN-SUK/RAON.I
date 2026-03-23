'use client';

import { CampgroundWithScore } from '@/types/camping-ajiit';
import { getSearchUrl, getKakaoMapUrl, getNaverMapUrl } from '@/lib/campground-recommendation';
import { cn } from '@/lib/utils';
import { Heart, MapPin, Navigation, ExternalLink, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CampgroundHeart from '@/components/shared/CampgroundHeart';

interface RecommendationCardProps {
    campground: CampgroundWithScore;
    rank: number;
    onFavoriteToggle?: (id: string) => void;
    className?: string;
}

/**
 * 추천 캠핑장 카드
 * Top 3 형태로 표시, 카카오맵/길찾기/예약 원탭 이동
 */
export function RecommendationCard({
    campground,
    rank,
    onFavoriteToggle,
    className,
}: RecommendationCardProps) {
    const hasHomepage = !!campground.homepage_url;

    // 태그 표시 (시설 + auto_tags 일부)
    const displayTags: string[] = [];
    if (campground.has_shower) displayTags.push('샤워');
    if (campground.has_electricity) displayTags.push('전기');
    if (campground.has_wifi) displayTags.push('Wi-Fi');
    if (campground.pet_allowed) displayTags.push('반려동물');
    if (campground.has_firepit) displayTags.push('불멍');
    if (campground.auto_tags) {
        displayTags.push(...campground.auto_tags.slice(0, 2));
    }
    const visibleTags = displayTags.slice(0, 5);

    return (
        <div
            className={cn(
                'relative bg-white rounded-2xl border border-gray-100',
                'shadow-sm hover:shadow-md transition-shadow',
                'p-4',
                className
            )}
        >
            {/* 랭킹 배지 */}
            <div
                className={cn(
                    'absolute -top-2 -left-2 w-8 h-8 rounded-full',
                    'flex items-center justify-center text-sm font-bold shadow-md',
                    rank === 1
                        ? 'bg-yellow-400 text-yellow-900'
                        : rank === 2
                            ? 'bg-gray-300 text-gray-700'
                            : 'bg-amber-600 text-white'
                )}
            >
                {rank}
            </div>

            <div className="pl-4">
                {/* 헤더: 이름 + 찜 */}
                <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                        <h4 className="text-base font-semibold text-gray-900 line-clamp-1">
                            🏕️ {campground.name}
                        </h4>
                        {campground.address && (
                            <p className="text-sm text-gray-500 line-clamp-1 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                {campground.address}
                            </p>
                        )}
                    </div>

                    {/* 찜 버튼 (V12.3 New Heart System) */}
                    <div className="flex flex-col items-center gap-1">
                        <CampgroundHeart 
                            campgroundId={campground.id}
                            initialIsHearted={campground.isFavorite}
                            size={20}
                            className="p-1.5"
                            onToggle={() => onFavoriteToggle?.(campground.id)}
                        />
                        <span className={cn(
                            "text-[10px] font-bold",
                            campground.isFavorite ? "text-red-500" : "text-gray-400"
                        )}>
                            {campground.favoriteCount || 0}
                        </span>
                    </div>
                </div>

                {/* 태그 */}
                {visibleTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                        {visibleTags.map((tag, idx) => (
                            <span
                                key={idx}
                                className="inline-block px-2 py-0.5 text-xs rounded-full bg-brand-1/10 text-brand-1"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                {/* 매칭 이유 */}
                <p className="text-sm text-gray-600 mb-3">
                    &quot;{campground.matchReason}&quot;
                </p>

                {/* 액션 버튼 */}
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1"
                        onClick={() => window.open(getKakaoMapUrl(
                            campground.name,
                            campground.lat ? Number(campground.lat) : undefined,
                            campground.lng ? Number(campground.lng) : undefined
                        ), '_blank')}
                    >
                        <Map className="w-4 h-4" />
                        지도
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1"
                        onClick={() => window.open(getNaverMapUrl(
                            campground.name,
                            campground.lat ? Number(campground.lat) : undefined,
                            campground.lng ? Number(campground.lng) : undefined
                        ), '_blank')}
                    >
                        <Navigation className="w-4 h-4" />
                        길찾기
                    </Button>

                    <Button
                        size="sm"
                        className="flex-1 gap-1 bg-brand-1 hover:bg-brand-1/90"
                        onClick={() => {
                            const url = hasHomepage
                                ? campground.homepage_url
                                : getSearchUrl(campground.name);
                            window.open(url, '_blank');
                        }}
                    >
                        <ExternalLink className="w-4 h-4" />
                        {hasHomepage ? '예약' : '검색'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default RecommendationCard;
