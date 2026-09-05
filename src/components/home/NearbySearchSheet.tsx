'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Sparkles, RefreshCw, Phone, ExternalLink, ShieldCheck, Award, Heart, Loader2 } from 'lucide-react';
import { getNearbyPlacesAction } from '@/actions/instant-plan';
import { StandardizedPlanJSON, FactCard } from '@/lib/smartPlan';
import { toast } from 'sonner';

interface NearbySearchSheetProps {
    isOpen: boolean;
    onClose: () => void;
    userLat?: number;
    userLng?: number;
    onSelectPlaceAsDestination?: (place: { name: string; lat: number; lng: number; address?: string }) => void;
}

type CategoryTab = 'ALL' | 'RESTAURANT' | 'CAFE' | 'SPOT' | 'MART_HOSPITAL';

export default function NearbySearchSheet({
    isOpen,
    onClose,
    userLat,
    userLng,
    onSelectPlaceAsDestination,
}: NearbySearchSheetProps) {
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<CategoryTab>('ALL');
    const [planData, setPlanData] = useState<StandardizedPlanJSON | null>(null);
    const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [locationNote, setLocationNote] = useState<string>('');

    // 위치 획득 및 데이터 로드
    const loadNearbyData = useCallback(async (lat?: number, lng?: number) => {
        setLoading(true);
        try {
            let targetLat = lat;
            let targetLng = lng;

            // 1. 전달된 좌표가 없으면 브라우저 Geolocation 조회 시도
            if (!targetLat || !targetLng) {
                if (typeof window !== 'undefined' && navigator.geolocation) {
                    try {
                        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                            navigator.geolocation.getCurrentPosition(resolve, reject, {
                                timeout: 4000,
                                maximumAge: 60000,
                                enableHighAccuracy: false,
                            });
                        });
                        targetLat = pos.coords.latitude;
                        targetLng = pos.coords.longitude;
                        setLocationNote('📍 현재 GPS 실시간 위치 기준');
                    } catch (geoErr) {
                        console.warn('GPS query failed/denied, falling back to default:', geoErr);
                    }
                }
            } else {
                setLocationNote('📍 현재 GPS 위치 기준');
            }

            // 2. 여전히 없으면 기본 라온아이 캠핑장 좌표 (충남 예산군) 폴백
            if (!targetLat || !targetLng) {
                targetLat = 36.6575; // 예산군 덕산면 라온아이
                targetLng = 126.6582;
                setLocationNote('📍 위치 권한 미허용으로 대표 위치(라온아이 캠핑장) 기준');
            }

            setCurrentCoords({ lat: targetLat, lng: targetLng });

            const res = await getNearbyPlacesAction({
                lat: targetLat,
                lng: targetLng,
                radiusKm: 5.0,
            });

            if (res.success && res.data) {
                setPlanData(res.data);
            } else {
                toast.error(res.error || '주변 장소를 불러오지 못했습니다.');
            }
        } catch (err: any) {
            console.error('Failed to load nearby places:', err);
            toast.error('주변 장소 검색 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadNearbyData(userLat, userLng);
        }
    }, [isOpen, userLat, userLng, loadNearbyData]);

    // 전체 장소 병합 (Primary + Alternatives)
    const allPlaces = useMemo(() => {
        if (!planData) return [];

        const list: (FactCard & { groupCategory: 'RESTAURANT' | 'CAFE' | 'SPOT' | 'MART_HOSPITAL' })[] = [];
        const seenIds = new Set<string>();

        const addPlace = (card: FactCard, groupCat: 'RESTAURANT' | 'CAFE' | 'SPOT' | 'MART_HOSPITAL') => {
            if (!card || !card.id || seenIds.has(card.id)) return;
            seenIds.add(card.id);
            list.push({ ...card, groupCategory: groupCat });
        };

        // 1. 맛집
        planData.itemListElement.filter(c => c.category === 'RESTAURANT').forEach(c => addPlace(c, 'RESTAURANT'));
        (planData.alternatives?.['RESTAURANT'] || []).forEach(c => addPlace(c, 'RESTAURANT'));

        // 2. 카페
        planData.itemListElement.filter(c => c.category === 'ROUTE_CAFE').forEach(c => addPlace(c, 'CAFE'));
        (planData.alternatives?.['ROUTE_CAFE'] || []).forEach(c => addPlace(c, 'CAFE'));

        // 3. 명소 & 축제
        planData.itemListElement.filter(c => c.category === 'SPOT' || c.category === 'FESTIVAL').forEach(c => addPlace(c, 'SPOT'));
        (planData.alternatives?.['SPOT'] || []).forEach(c => addPlace(c, 'SPOT'));
        (planData.alternatives?.['FESTIVAL'] || []).forEach(c => addPlace(c, 'SPOT'));

        // 4. 마트 & 병원
        planData.itemListElement.filter(c => c.category === 'MART' || c.category === 'HOSPITAL').forEach(c => addPlace(c, 'MART_HOSPITAL'));
        (planData.alternatives?.['MART'] || []).forEach(c => addPlace(c, 'MART_HOSPITAL'));
        (planData.alternatives?.['HOSPITAL'] || []).forEach(c => addPlace(c, 'MART_HOSPITAL'));

        return list;
    }, [planData]);

    // 탭 필터링
    const filteredPlaces = useMemo(() => {
        if (activeTab === 'ALL') return allPlaces;
        return allPlaces.filter(p => p.groupCategory === activeTab);
    }, [allPlaces, activeTab]);

    // 외부 지도 앱 길찾기
    const handleOpenMap = (place: FactCard) => {
        const addr = place.metadata?.address || place.metadata?.addr || '';
        const query = encodeURIComponent(`${place.name} ${addr}`);
        const naverUrl = `https://map.naver.com/v5/search/${query}`;
        window.open(naverUrl, '_blank');
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="bottom" className="rounded-t-3xl max-h-[88vh] h-[88vh] flex flex-col p-0 bg-stone-50 dark:bg-zinc-950 overflow-hidden">
                {/* 상단 헤더 */}
                <SheetHeader className="p-4 pb-2 border-b border-stone-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 rounded-xl">
                                <MapPin className="w-5 h-5" />
                            </div>
                            <div>
                                <SheetTitle className="text-base font-black text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                                    내 주변 5km 실시간 탐색
                                    <span className="text-[10px] bg-emerald-500 text-white font-bold px-1.5 py-0.5 rounded-full">0원 랭킹</span>
                                </SheetTitle>
                                <p className="text-[11px] text-stone-500 font-medium mt-0.5">
                                    {locationNote || '반경 5km 우리 DB 엄선 장소'}
                                </p>
                            </div>
                        </div>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => loadNearbyData(currentCoords?.lat, currentCoords?.lng)}
                            disabled={loading}
                            className="h-8 px-2.5 text-xs text-stone-500 hover:text-stone-800"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
                            새로고침
                        </Button>
                    </div>

                    {/* 카테고리 탭 */}
                    <div className="flex gap-1.5 overflow-x-auto pt-2 pb-1 scrollbar-hide">
                        {[
                            { id: 'ALL', label: `전체 (${allPlaces.length})` },
                            { id: 'RESTAURANT', label: `🍽️ 맛집 (${allPlaces.filter(p => p.groupCategory === 'RESTAURANT').length})` },
                            { id: 'CAFE', label: `☕ 카페 (${allPlaces.filter(p => p.groupCategory === 'CAFE').length})` },
                            { id: 'SPOT', label: `🏞️ 명소·축제 (${allPlaces.filter(p => p.groupCategory === 'SPOT').length})` },
                            { id: 'MART_HOSPITAL', label: `🛡️ 마트·병원 (${allPlaces.filter(p => p.groupCategory === 'MART_HOSPITAL').length})` },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as CategoryTab)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                                    activeTab === tab.id
                                        ? 'bg-[#224732] text-white shadow-sm'
                                        : 'bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </SheetHeader>

                {/* 본문 리스트 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
                            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                            <p className="text-xs font-bold text-stone-700">반경 5km 검증 DB 실시간 스코어링 중...</p>
                            <p className="text-[11px] text-stone-400">네이버 4대 인증 및 거리 감점 공식을 적용하고 있습니다.</p>
                        </div>
                    ) : filteredPlaces.length === 0 ? (
                        <div className="py-20 text-center space-y-2">
                            <p className="text-3xl">🔍</p>
                            <p className="text-sm font-bold text-stone-700">반경 5km 내 조건에 맞는 장소가 없습니다.</p>
                            <p className="text-xs text-stone-400">새로고침하거나 검색 범위를 확장해보세요.</p>
                        </div>
                    ) : (
                        filteredPlaces.map((place) => {
                            const isRestaurant = place.category === 'RESTAURANT';
                            const isCafe = place.category === 'ROUTE_CAFE';
                            const isHospital = place.category === 'HOSPITAL';
                            const isFestival = place.category === 'FESTIVAL';

                            return (
                                <div
                                    key={place.id}
                                    className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-stone-200/80 dark:border-zinc-800 shadow-sm space-y-2.5 transition-all hover:border-emerald-300"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-1 min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                                                    {isRestaurant ? '🍲 맛집' : isCafe ? '☕ 카페' : isFestival ? '🎉 축제' : isHospital ? '🏥 응급의료' : '🏞️ 명소'}
                                                </span>
                                                {place.evidence?.certifications?.map((cert, i) => (
                                                    <span
                                                        key={i}
                                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/60"
                                                    >
                                                        {cert}
                                                    </span>
                                                ))}
                                                {place.distanceKm !== undefined && (
                                                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                        📍 {place.distanceKm.toFixed(1)}km
                                                    </span>
                                                )}
                                            </div>

                                            <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 leading-snug">
                                                {place.name}
                                            </h4>

                                            {(place.metadata?.address || place.metadata?.addr) && (
                                                <p className="text-[11px] text-stone-400 truncate">
                                                    {place.metadata?.address || place.metadata?.addr}
                                                </p>
                                            )}
                                        </div>

                                        {place.trustScore !== undefined && (
                                            <div className="text-right shrink-0">
                                                <span className="text-[11px] font-black text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-lg">
                                                    {place.trustScore.toFixed(0)}점
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* 한줄 설명 또는 시그니처 메뉴 */}
                                    {(place.metadata?.signatureMenu || place.description) && (
                                        <div className="bg-stone-50 dark:bg-zinc-800/60 rounded-xl px-3 py-2 text-xs text-stone-700 dark:text-stone-300">
                                            <span className="font-bold text-stone-500 mr-1.5">
                                                {place.metadata?.signatureMenu ? '대표:' : '안내:'}
                                            </span>
                                            {place.metadata?.signatureMenu || place.description}
                                        </div>
                                    )}

                                    {/* 액션 버튼 */}
                                    <div className="flex items-center gap-2 pt-1 border-t border-stone-100 dark:border-zinc-800">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleOpenMap(place)}
                                            className="flex-1 h-8 text-xs font-semibold text-stone-700 border-stone-200 hover:bg-stone-100 rounded-xl gap-1"
                                        >
                                            <Navigation className="w-3.5 h-3.5 text-blue-600" />
                                            길찾기
                                        </Button>

                                        {onSelectPlaceAsDestination && (
                                            <Button
                                                size="sm"
                                                onClick={() => {
                                                    onSelectPlaceAsDestination({
                                                        name: place.name,
                                                        lat: place.lat,
                                                        lng: place.lng,
                                                        address: place.metadata?.address || place.metadata?.addr || '',
                                                    });
                                                    onClose();
                                                }}
                                                className="flex-1 h-8 text-xs font-bold bg-[#224732] hover:bg-[#1b3928] text-white rounded-xl gap-1"
                                            >
                                                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                                1초 플랜 만들기
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
