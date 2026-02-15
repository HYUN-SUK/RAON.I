'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import {
    CampingMode,
    ToggleKey,
    CAMPING_MODES,
    Campground,
    CampgroundWithScore,
} from '@/types/camping-ajiit';
import { recommendCampgrounds } from '@/lib/campground-recommendation';
import { useLBS } from '@/hooks/useLBS';

import ModeSelector from '@/components/planlock/ModeSelector';
import ToggleSelector from '@/components/planlock/ToggleSelector';
import RecommendationCard from '@/components/planlock/RecommendationCard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RotateCcw, Loader2, Users, User, Heart, Flame, Car, Leaf } from 'lucide-react';
import { toast } from 'sonner';

// 모드 아이콘 매핑
const MODE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    Users,
    User,
    Heart,
    Flame,
    Car,
    Leaf,
};

/**
 * Plan Lock 메인 페이지
 * 1. 모드 선택 → 2. 토글 선택 → 3. 추천 결과
 */
export default function PlanLockPage() {
    const router = useRouter();
    const supabase = createClient();
    const { location, isLoading: locationLoading } = useLBS();

    // 단계 관리 (0: 모드, 1: 토글, 2: 결과)
    const [step, setStep] = useState(0);

    // 선택 상태
    const [selectedMode, setSelectedMode] = useState<CampingMode | null>(null);
    const [selectedToggles, setSelectedToggles] = useState<ToggleKey[]>([]);
    const [distanceKm, setDistanceKm] = useState(100);

    // 데이터 상태
    const [campgrounds, setCampgrounds] = useState<Campground[]>([]);
    const [recommendations, setRecommendations] = useState<CampgroundWithScore[]>([]);
    const [favorites, setFavorites] = useState<Map<string, number>>(new Map());
    const [userFavorites, setUserFavorites] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);

    // 모드 선택 시 기본 토글/거리 설정
    const handleModeSelect = (mode: CampingMode) => {
        setSelectedMode(mode);
        const modeConfig = CAMPING_MODES.find((m) => m.key === mode);
        if (modeConfig) {
            setSelectedToggles(modeConfig.defaultToggles);
            setDistanceKm(modeConfig.defaultDistance);
        }
    };

    // 다음 단계
    const handleNext = () => {
        if (step === 0 && !selectedMode) {
            toast.info('캠핑 모드를 선택해 주세요');
            return;
        }
        if (step === 1) {
            // 추천 실행
            fetchRecommendations();
        }
        setStep((prev) => Math.min(prev + 1, 2));
    };

    // 이전 단계
    const handleBack = () => {
        if (step === 0) {
            router.back();
        } else {
            setStep((prev) => prev - 1);
        }
    };

    // 캠핑장 데이터 및 찜 정보 로드
    const fetchCampgroundData = useCallback(async () => {
        const { data: cgData } = await supabase
            .from('campgrounds')
            .select('*')
            .order('name');

        if (cgData) {
            setCampgrounds(cgData as Campground[]);
        }

        // 찜 수 집계
        const { data: favCountData } = await supabase
            .from('campground_favorites_count')
            .select('campground_id, favorite_count');

        if (favCountData) {
            const map = new Map<string, number>();
            favCountData.forEach((row) => {
                map.set(row.campground_id, row.favorite_count);
            });
            setFavorites(map);
        }

        // 사용자 찜 목록
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: userFavData } = await supabase
                .from('user_favorites')
                .select('campground_id')
                .eq('user_id', user.id);

            if (userFavData) {
                setUserFavorites(new Set(userFavData.map((f) => f.campground_id)));
            }
        }
    }, [supabase]);

    useEffect(() => {
        fetchCampgroundData();
    }, [fetchCampgroundData]);

    // 추천 결과 가져오기
    const fetchRecommendations = async () => {
        if (!selectedMode) return;

        setLoading(true);
        try {
            const results = recommendCampgrounds(campgrounds, favorites, userFavorites, {
                mode: selectedMode,
                toggles: selectedToggles,
                userLat: location?.latitude,
                userLng: location?.longitude,
                maxDistance: distanceKm,
                limit: 3,
            });
            setRecommendations(results);
        } catch (error) {
            console.error('추천 오류:', error);
            toast.error('추천 결과를 불러오지 못했어요');
        } finally {
            setLoading(false);
        }
    };

    // 찜 토글
    const handleFavoriteToggle = async (campgroundId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            toast.info('로그인 후 찜할 수 있어요');
            return;
        }

        const isFavorite = userFavorites.has(campgroundId);

        if (isFavorite) {
            // 찜 해제
            await supabase
                .from('user_favorites')
                .delete()
                .eq('user_id', user.id)
                .eq('campground_id', campgroundId);

            setUserFavorites((prev) => {
                const next = new Set(prev);
                next.delete(campgroundId);
                return next;
            });
            toast.success('찜 목록에서 제거했어요');
        } else {
            // 찜 추가
            await supabase.from('user_favorites').insert({
                user_id: user.id,
                campground_id: campgroundId,
            });

            setUserFavorites((prev) => new Set(prev).add(campgroundId));
            toast.success('찜 목록에 추가했어요');
        }

        // 찜 수 갱신
        fetchCampgroundData();
    };

    // 재추천
    const handleRefresh = () => {
        fetchRecommendations();
    };

    // 렌더링
    const modeConfig = selectedMode
        ? CAMPING_MODES.find((m) => m.key === selectedMode)
        : null;

    return (
        <div className="min-h-screen bg-surface-1">
            {/* 헤더 */}
            <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-100">
                <div className="flex items-center justify-between px-4 h-14">
                    <button
                        type="button"
                        onClick={handleBack}
                        className="p-2 -ml-2 rounded-lg hover:bg-gray-100"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-lg font-semibold">
                        {step === 0 && '캠핑 계획하기'}
                        {step === 1 && '시설 선택'}
                        {step === 2 && '추천 캠핑장'}
                    </h1>
                    <div className="w-10" /> {/* 균형용 */}
                </div>

                {/* 진행 바 */}
                <div className="h-1 bg-gray-100">
                    <div
                        className="h-full bg-brand-1 transition-all duration-300"
                        style={{ width: `${((step + 1) / 3) * 100}%` }}
                    />
                </div>
            </header>

            {/* 메인 콘텐츠 */}
            <main className="p-4 pb-24">
                {/* Step 0: 모드 선택 */}
                {step === 0 && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <ModeSelector
                            selectedMode={selectedMode}
                            onSelect={handleModeSelect}
                        />

                        {/* My Wishlist Card */}
                        <div className="mt-6">
                            <button
                                onClick={() => router.push('/myspace/wishlist')}
                                className="w-full bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-brand-1/10 flex items-center justify-center text-brand-1">
                                        <Heart className="w-5 h-5 fill-brand-1/20" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="font-bold text-gray-900">나의 위시리스트</h3>
                                        <p className="text-xs text-gray-500">찜해둔 캠핑장을 확인해보세요</p>
                                    </div>
                                </div>
                                <ArrowLeft className="w-4 h-4 text-gray-400 rotate-180" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 1: 토글 선택 */}
                {step === 1 && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        {/* 선택된 모드 표시 */}
                        {modeConfig && (
                            <div className="flex items-center gap-2 mb-6 p-3 bg-brand-1/5 rounded-xl">
                                <div className="w-10 h-10 rounded-xl bg-brand-1/10 flex items-center justify-center">
                                    {MODE_ICON_MAP[modeConfig.icon] && (
                                        React.createElement(MODE_ICON_MAP[modeConfig.icon], {
                                            className: 'w-5 h-5 text-brand-1'
                                        })
                                    )}
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">선택한 모드</p>
                                    <p className="font-semibold text-brand-1">
                                        {modeConfig.label} 캠핑
                                    </p>
                                </div>
                            </div>
                        )}

                        <ToggleSelector
                            selectedToggles={selectedToggles}
                            onToggle={setSelectedToggles}
                        />

                        {/* 거리 설정 (슬라이더) */}
                        <div className="mt-8">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    검색 거리
                                </h3>
                                <span className="text-sm font-medium text-brand-1">
                                    {distanceKm}km 이내
                                </span>
                            </div>
                            <input
                                type="range"
                                min={30}
                                max={200}
                                step={10}
                                value={distanceKm}
                                onChange={(e) => setDistanceKm(Number(e.target.value))}
                                className="w-full accent-brand-1"
                            />
                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                                <span>30km</span>
                                <span>200km</span>
                            </div>
                        </div>

                        {/* 위치 안내 */}
                        {locationLoading && (
                            <p className="text-sm text-gray-500 mt-4 flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                현재 위치를 확인하고 있어요...
                            </p>
                        )}
                    </div>
                )}

                {/* Step 2: 추천 결과 */}
                {step === 2 && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        {/* 선택 요약 */}
                        {modeConfig && (
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">{modeConfig.icon}</span>
                                    <div className="text-sm">
                                        <span className="font-medium text-brand-1">
                                            {modeConfig.label}
                                        </span>
                                        <span className="text-gray-400"> · {distanceKm}km</span>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleRefresh}
                                    disabled={loading}
                                    className="gap-1"
                                >
                                    <RotateCcw className={`w-4 h-4 ${loading && 'animate-spin'}`} />
                                    다시 추천
                                </Button>
                            </div>
                        )}

                        {/* 추천 카드 */}
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-brand-1" />
                                <p className="text-gray-500">맞춤 캠핑장을 찾고 있어요...</p>
                            </div>
                        ) : recommendations.length > 0 ? (
                            <div className="space-y-4">
                                {recommendations.map((cg, idx) => (
                                    <RecommendationCard
                                        key={cg.id}
                                        campground={cg}
                                        rank={idx + 1}
                                        onFavoriteToggle={handleFavoriteToggle}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <p className="text-gray-500 mb-4">
                                    조건에 맞는 캠핑장을 찾지 못했어요
                                </p>
                                <Button variant="outline" onClick={() => setStep(1)}>
                                    조건 수정하기
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* 하단 버튼 */}
            {step < 2 && (
                <div className="fixed bottom-16 left-0 right-0 p-4 bg-white border-t border-gray-100 z-50">
                    <Button
                        onClick={handleNext}
                        disabled={step === 0 && !selectedMode}
                        className="w-full h-12 text-base bg-brand-1 hover:bg-brand-1/90"
                    >
                        {step === 0 && '다음'}
                        {step === 1 && '캠핑장 추천받기'}
                    </Button>
                </div>
            )}
        </div>
    );
}
