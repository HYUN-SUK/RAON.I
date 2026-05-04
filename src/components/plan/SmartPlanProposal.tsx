'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Navigation, Map as MapIcon, RefreshCw, ShieldCheck, Heart, ArrowRightLeft, MapPin, Share2, RefreshCcw } from 'lucide-react';
import { StandardizedPlanJSON, FactCard } from '@/lib/smartPlan';
import { dispatchPersonaAction } from '@/lib/persona';
import { updateSmartPlanData } from '@/actions/schedule';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { toast } from 'sonner';

interface SmartPlanProposalProps {
    scheduleId?: string;
    initialPlan?: any;
    userId?: string;
    location: { lat: number; lng: number };
    startDate: Date;
    endDate: Date;
    weatherContext?: string;
    mockData?: StandardizedPlanJSON;
    /** 출발지 좌표 (캠핑 프로필에서 전달). 없으면 브라우저 geolocation fallback */
    origin?: { lat: number; lng: number };
    onReset?: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
    'ROUTE_CAFE': '☕',
    'ROUTE_RESTAURANT': '🍲',
    'ROUTE_SPOT': '📸',
    'HOSPITAL': '🏥',
    'MART': '🛒',
    'GAS_STATION': '⛽',
    'RESTAURANT': '🍽️',
    'SPOT': '🏞️',
    'FESTIVAL': '🎪'
};

const CATEGORY_NAMES: Record<string, string> = {
    'ROUTE_CAFE': '경로 휴게/카페',
    'ROUTE_RESTAURANT': '가는 길 식사',
    'ROUTE_SPOT': '가는 길 명소',
    'HOSPITAL': '인근 병원/약국',
    'MART': '마트/편의장비',
    'GAS_STATION': '주유/등유/차박',
    'RESTAURANT': '현지 맛집',
    'SPOT': '주변 인생샷 명소',
    'FESTIVAL': '로컬 축제/이벤트'
};

export default function SmartPlanProposal({
    scheduleId,
    initialPlan,
    userId,
    location,
    startDate,
    endDate,
    weatherContext,
    mockData,
    origin,
    onReset
}: SmartPlanProposalProps) {
    const [plan, setPlan] = useState<StandardizedPlanJSON | null>(initialPlan || mockData || null);
    const [isLoading, setIsLoading] = useState(!initialPlan && !mockData);
    const [swapCategory, setSwapCategory] = useState<string | null>(null);
    const [swapPage, setSwapPage] = useState(0);
    const [userOrigin, setUserOrigin] = useState<{ lat: number; lng: number } | undefined>(origin);
    const [navTargetCard, setNavTargetCard] = useState<FactCard | null>(null);

    // 1. Get User's Current Location (Origin) — 프로필에서 origin이 제공되면 생략
    useEffect(() => {
        if (origin) {
            setUserOrigin(origin);
            return;
        }
        if (!mockData && typeof window !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setUserOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                },
                (err) => {
                    console.warn("[SmartPlan] Failed to get user location:", err);
                }
            );
        }
    }, [mockData, origin]);

    // [v11.9.29] 무한 루프 방지: 객체/Date 대신 원시값으로 의존성 배열 비교
    const locLat = location.lat;
    const locLng = location.lng;
    const startStr = startDate.toISOString();
    const endStr = endDate.toISOString();
    const originLat = userOrigin?.lat;
    const originLng = userOrigin?.lng;

    // 2. Fetch Plan via Server API Route
    useEffect(() => {
        if (mockData || initialPlan) return;

        async function fetchPlan() {
            setIsLoading(true);
            try {
                const res = await fetch('/api/smart-plan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId,
                        location: { lat: locLat, lng: locLng },
                        startDate: startStr,
                        endDate: endStr,
                        origin: originLat && originLng ? { lat: originLat, lng: originLng } : undefined
                    })
                });
                if (!res.ok) throw new Error(`API Error: ${res.status}`);
                const generatedPlan = await res.json();
                setPlan(generatedPlan);
                if (scheduleId) {
                    updateSmartPlanData(scheduleId, generatedPlan).catch(console.error);
                }
            } catch (error) {
                console.error("Failed to fetch smart plan:", error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchPlan();
    }, [userId, locLat, locLng, startStr, endStr, originLat, originLng, mockData]);

    const handleSwapOptionSelected = (category: string, newCardId: string) => {
        if (!plan) return;
        // Find if it's in itemListElement or routeListElement
        const inItemIndex = plan.itemListElement.findIndex(c => c.category === category);
        const inRouteIndex = plan.routeListElement?.findIndex(c => c.category === category) ?? -1;

        const isRoute = inRouteIndex !== -1;
        const currentActiveInfo = isRoute && plan.routeListElement ? plan.routeListElement[inRouteIndex] :
            (inItemIndex !== -1 ? plan.itemListElement[inItemIndex] : null);

        const alternativeCards = plan.alternatives?.[category] || [];
        const newActiveInfo = alternativeCards.find(c => c.id === newCardId);

        if (currentActiveInfo && newActiveInfo) {
            if (userId) {
                // Trigger Actions (Phase 3 Sync)
                if (newActiveInfo.category === 'MART' && newActiveInfo.metadata?.hasMilkit) {
                    dispatchPersonaAction(userId, 'PLAN_SWAP_MEALKIT').catch(console.error);
                }
                if (newActiveInfo.category === 'RESTAURANT' && (newActiveInfo.metadata?.isHighEnd || newActiveInfo.metadata?.isHighLuxury)) {
                    dispatchPersonaAction(userId, 'PLAN_SWAP_LUXURY').catch(console.error);
                }
                if (newActiveInfo.category === 'MART' && newActiveInfo.metadata?.isVintage) {
                    dispatchPersonaAction(userId, 'PLAN_SWAP_VINTAGE').catch(console.error);
                }
                if (newActiveInfo.category === 'SPOT' && newActiveInfo.metadata?.isNatureWalk) {
                    dispatchPersonaAction(userId, 'PLAN_SWAP_WALK').catch(console.error);
                }
                if (newActiveInfo.metadata?.isScenic) {
                    dispatchPersonaAction(userId, 'PLAN_FILTER_VIEW').catch(console.error);
                }
                if (newActiveInfo.category === 'HOSPITAL' || newActiveInfo.category === 'FACILITY') {
                    dispatchPersonaAction(userId, 'PLAN_FILTER_PRIVATE').catch(console.error);
                }
            }

            // [v11.9.26] 선택한 위치에 기존 장소를 그대로 맞교환 (순위 유지)
            const newAltsList = [...alternativeCards];
            const targetIdx = alternativeCards.findIndex(c => c.id === newCardId);
            if (targetIdx !== -1) {
                newAltsList[targetIdx] = currentActiveInfo;
            }

            const updatedPlan = { ...plan, alternatives: { ...plan.alternatives, [category]: newAltsList } };

            if (isRoute && updatedPlan.routeListElement) {
                const newRouteList = [...updatedPlan.routeListElement];
                newRouteList[inRouteIndex] = newActiveInfo;
                updatedPlan.routeListElement = newRouteList;
            } else {
                const newActiveList = [...updatedPlan.itemListElement];
                newActiveList[inItemIndex] = newActiveInfo;
                updatedPlan.itemListElement = newActiveList;
            }

            setPlan(updatedPlan);
            if (scheduleId) {
                updateSmartPlanData(scheduleId, updatedPlan).catch(console.error);
            }
            setSwapCategory(null);
        }
    };

    // [v11.9.27] 카드 클릭 시 외부 링크 또는 검색 연동
    const handleCardClick = (card: FactCard) => {
        if (userId) {
            dispatchPersonaAction(userId, 'PLAN_CARD_DETAIL').catch(console.error);
        }
        const officialUrl = card.metadata?.url || card.metadata?.homepage || card.metadata?.link;
        if (officialUrl && officialUrl !== '없음') {
            window.open(officialUrl, '_blank');
        } else {
            const query = encodeURIComponent(card.name);
            // 1순위 네이버 검색, 2순위 구글 검색 (필요시)
            window.open(`https://search.naver.com/search.naver?query=${query}`, '_blank');
        }
    };

    const handleNavClick = (e: React.MouseEvent, card: FactCard) => {
        e.stopPropagation();
        setNavTargetCard(card);
    };

    const handleNavChoice = (app: 'kakao' | 'tmap' | 'kakaonavi') => {
        if (!navTargetCard) return;
        
        if (userId) {
            dispatchPersonaAction(userId, 'PLAN_CLICK_NAVI').catch(console.error);
        }

        const { name, lat, lng } = navTargetCard;
        if (app === 'kakao') {
            window.open(`https://map.kakao.com/link/to/${name},${lat},${lng}`, '_blank');
        } else if (app === 'tmap') {
            // T-Map URL Scheme (Mobile)
            window.open(`tmap://route?goalname=${encodeURIComponent(name)}&goallat=${lat}&goallng=${lng}`, '_blank');
            // Fallback for non-mobile or app not installed
            setTimeout(() => {
                window.open(`https://map.naver.com/v5/directions/-/,,${lng},${lat},${name}/-`, '_blank');
            }, 500);
        } else if (app === 'kakaonavi') {
            // KakaoNavi URL Scheme (Mobile)
            window.open(`kakaonavi://navigate?name=${encodeURIComponent(name)}&x=${lng}&y=${lat}&coord_type=wgs84`, '_blank');
            // Fallback: KakaoMap URL
            setTimeout(() => {
                window.open(`https://map.kakao.com/link/to/${name},${lat},${lng}`, '_blank');
            }, 500);
        }
        setNavTargetCard(null);
    };

    const handleShareClick = () => {
        if (userId) {
            dispatchPersonaAction(userId, 'PLAN_SHARE_SNS').catch(console.error);
        }
        toast.success('플랜 이미지가 생성되었습니다. SNS로 공유해보세요!');
    };

    if (isLoading) {
        return (
            <div className="w-full flex flex-col items-center justify-center p-12 space-y-5 bg-[#F7F5EF] rounded-3xl border border-dashed border-[#224732]/20 shadow-sm animate-pulse m-0">
                <RefreshCw className="w-10 h-10 text-[#224732] animate-spin" />
                <p className="text-sm font-medium text-[#224732] text-center">
                    캠퍼님의 취향과 주변 인프라를 분석해<br />
                    세상에 단 하나뿐인 일정을 조립하는 중...
                </p>
            </div>
        );
    }

    if (!plan) return null;

    const swapOptions = swapCategory ? [
        (plan.itemListElement.find(c => c.category === swapCategory) || plan.routeListElement?.find(c => c.category === swapCategory))!, // Current Active
        ...(plan.alternatives?.[swapCategory] || []) // 2 Alternatives
    ] : [];

    const renderNarration = (text: string) => {
        if (!text) return text;

        // 정규식: ||ID|이름|| 패턴을 찾습니다.
        const regex = /(\|\|[^|]+\|[^|]+\|\|)/g;
        const tokens = text.split(regex);

        return tokens.map((token, index) => {
            // 태그 매치 확인 (|| 로 시작하고 끝나는지)
            if (token.startsWith('||') && token.endsWith('||')) {
                const inner = token.slice(2, -2); // ID|이름
                const parts = inner.split('|');
                if (parts.length === 2) {
                    const factId = parts[0];
                    const placeName = parts[1];

                    const fact = plan.itemListElement.find(f => f.id === factId) ||
                        plan.routeListElement?.find(f => f.id === factId) ||
                        Object.values(plan.alternatives || {}).flat().find(f => f.id === factId);

                    if (fact) {
                        return (
                            <span
                                key={`tag-${index}`}
                                onClick={(e) => { e.stopPropagation(); setSwapCategory(fact.category); }}
                                className="inline-flex cursor-pointer text-[#F7F5EF] font-bold bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-lg mx-1 transition-colors border-b-2 border-[#F7F5EF]/40 hover:border-[#F7F5EF]"
                            >
                                {placeName}
                            </span>
                        );
                    }
                    return <span key={`text-fallback-${index}`}>{placeName}</span>;
                }
            }
            // 일반 텍스트 반환
            return <span key={`text-${index}`}>{token}</span>;
        });
    };

    const renderFactCard = (card: FactCard, stage?: string) => (
        <Card
            key={card.id}
            className={`relative z-10 overflow-hidden transition-all duration-300 cursor-pointer hover:border-[#224732]/30 hover:shadow-sm border-gray-100/80 bg-white ml-10`}
            onClick={() => handleCardClick(card)}
        >
            <CardContent className="p-4">
                <div className="flex gap-4 items-center">
                    {/* Icon */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-[#F7F5EF] text-[#224732] flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] text-xl border border-[#224732]/5">
                        {CATEGORY_ICONS[card.category] || '📍'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-bold text-[#224732] px-1.5 py-0.5 bg-[#224732]/5 rounded-sm">
                                {card.roleName || CATEGORY_NAMES[card.category] || '추천 장소'}
                            </span>
                            {card.verificationStatus === 'VERIFIED' && (
                                <span className="flex items-center text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-sm">
                                    <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />
                                    검증됨
                                </span>
                            )}
                        </div>
                        <h4 className="font-bold text-gray-900 text-[15px] truncate">{card.name}</h4>
                        
                        {/* [v11.9.32] Stage 2, 5 주소 표기 추가 */}
                        {['2', '5'].includes(stage || '') && (card.metadata?.address || card.metadata?.addr) && (
                            <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1 truncate">
                                <MapPin className="w-2.5 h-2.5 shrink-0" />
                                {card.metadata.address || card.metadata.addr}
                            </p>
                        )}

                        <p className="text-xs text-gray-500 mt-1 line-clamp-1 leading-relaxed">
                            {card.description}
                        </p>

                        {/* [v11.9.25] 한 줄 소개 */}
                        {card.reasoning && (
                            <p className="text-[12px] text-gray-600 mt-0.5 leading-snug italic">
                                "{card.reasoning}"
                            </p>
                        )}

                        {/* Fact Chips (v2 Phase 2) */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {card.evidence?.stars !== undefined && card.evidence.stars > 0 && (
                                <span className="text-[10px] bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded-md font-bold border border-yellow-100/50">
                                    ⭐ {card.evidence.stars.toFixed(1)}
                                </span>
                            )}
                            {card.evidence?.reviews !== undefined && card.evidence.reviews > 0 && (
                                <span className="text-[10px] bg-gray-50 text-gray-600 px-1.5 py-0.5 rounded-md font-medium border border-gray-100">
                                    💬 리뷰 {card.evidence.reviews >= 100 ? '100+' : card.evidence.reviews}
                                </span>
                            )}
                            {/* [v11.9.26] 인증 이모지만 노출 (기존 스타일 복구) */}
                            {(card.evidence?.displayBadges || []).map((badge, idx) => (
                                <span key={idx} className="text-[12px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-100 flex items-center justify-center leading-none shadow-sm" title={badge.label}>
                                    {badge.emoji}
                                </span>
                            ))}
                            {/* [v11.9.26] 스테이지 2, 5(경유지)는 거리 제거 */}
                            {!['2', '5'].includes(stage || '') && card.distanceKm && (
                                <span className="text-[10px] text-gray-400 font-medium">
                                    📍 {card.distanceKm}km 거리
                                </span>
                            )}
                        </div>
                    </div>


                    {/* Actions */}
                    <div className="flex flex-col gap-2 shrink-0">
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setSwapCategory(card.category); 
                                setSwapPage(0); 
                            }}
                            className="h-8 w-8 rounded-full bg-gray-50 text-gray-500 hover:text-[#224732] hover:bg-[#224732]/10"
                        >
                            <ArrowRightLeft className="w-4 h-4" />
                        </Button>
                        <Button
                            size="icon"
                            onClick={(e) => handleNavClick(e, card)}
                            className="h-8 w-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 shadow-none border-none"
                        >
                            <MapPin className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6">
            {/* 1. Header & AI Narration Section */}
            <div className="relative p-6 bg-gradient-to-br from-[#224732] via-[#1a3626] to-[#0f2117] rounded-[24px] overflow-hidden shadow-md">
                <div className="absolute -top-4 -right-4 p-4 opacity-10 transform rotate-12">
                    <MapIcon className="w-40 h-40 text-white" />
                </div>

                <div className="relative pt-6 pb-12 px-6">
                    {/* [v11.9.32] 실험용 재구성 버튼 (tootg 전용) */}
                    {userId === '4730be31-30b5-4594-a993-d8f5a7a5e26c' && onReset && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('플랜을 처음부터 다시 구성할까요? (실험용)')) {
                                    onReset();
                                }
                            }}
                            className="absolute top-6 right-6 z-20 p-2.5 bg-white/10 hover:bg-white/20 rounded-xl border border-white/10 transition-all active:scale-95 group"
                            title="플랜 재구성 (실험용)"
                        >
                            <RefreshCcw className="w-5 h-5 text-white/80 group-hover:text-white transition-transform group-hover:rotate-180 duration-700" />
                        </button>
                    )}
                    <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-semibold tracking-wide backdrop-blur-sm">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                        </span>
                        <span>AI 스마트 여정 가이드</span>
                    </div>

                    {/* [v11.9.25] stageIntros 모듈형 연동 (Fallback: narration) */}
                    {plan.stageIntros ? (
                        <p className="text-lg leading-loose font-medium text-white/90 tracking-tight">
                            {plan.stageIntros['1'] || ''}
                        </p>
                    ) : (
                        <p className="text-lg leading-loose font-medium text-white/90 tracking-tight whitespace-pre-wrap">
                            {renderNarration(plan.narration)}
                        </p>
                    )}

                    <div className="pt-2 flex justify-end">
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={handleShareClick}
                            className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-bold rounded-xl h-9"
                        >
                            <Share2 className="w-3.5 h-3.5 mr-1.5" />
                            플랜 공유하기
                        </Button>
                    </div>
                </div>
            </div>

            {/* 2. Fact List / 5-Stage Emotional Timeline UI */}
            <div className="space-y-6 pt-2">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider px-2 flex items-center justify-between">
                    <span>{plan.target_date || ''} 최종 추천 일정표</span>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">카드를 터치해 일정을 교체하세요</span>
                </h3>

                <div className="grid gap-8 relative before:absolute before:inset-0 before:left-[35px] md:before:left-[35px] before:w-0.5 before:bg-[#224732]/10 before:z-0">

                    {/* Stage 1: 출발 (Intro) */}
                    <div className="space-y-3 relative z-10 w-full pl-2">
                        <div className="flex flex-col gap-1 mb-2 ml-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full border-2 border-[#224732] bg-white ring-4 ring-white z-10 -ml-[5.5px]" />
                                <span className="text-xs font-bold text-[#224732]">Stage 1. 설레는 출발</span>
                            </div>
                            {/* 1단계 서사는 상단 히어로 영역에서 '종합 브리핑'으로 제공되므로 하단 리스트에서는 생략합니다. */}
                        </div>
                    </div>

                    {/* Stage 2: 가는 길 (Route Facts) */}
                    {(plan.routeListElement || []).length > 0 && (
                        <div className="space-y-3 relative z-10 w-full pl-2">
                            <div className="flex flex-col gap-1 mb-2 ml-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-[#224732] ring-4 ring-white z-10 -ml-[5.5px]" />
                                    <span className="text-xs font-bold text-[#224732]">Stage 2. 여정의 즐거움 (경유지)</span>
                                </div>
                                {plan.stageIntros?.['2'] && (
                                    <p className="text-[11px] text-gray-500 italic ml-5 leading-relaxed">"{plan.stageIntros['2']}"</p>
                                )}
                            </div>
                            {plan.routeListElement?.map((card) => renderFactCard(card, '2'))}

                        </div>
                    )}

                    {/* Stage 3: 캠프 준비 (Mart / Restaurant) */}
                    <div className="space-y-3 relative z-10 w-full pl-2">
                        <div className="flex flex-col gap-1 mb-2 ml-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-[#224732] ring-4 ring-white z-10 -ml-[5.5px]" />
                                <span className="text-xs font-bold text-[#224732]">Stage 3. 든든한 준비 (식사/장보기)</span>
                            </div>
                            {plan.stageIntros?.['3'] && (
                                <p className="text-[11px] text-gray-500 italic ml-5 leading-relaxed">"{plan.stageIntros['3']}"</p>
                            )}
                        </div>
                        {plan.itemListElement
                            .filter(c => ['MART', 'RESTAURANT'].includes(c.category))
                            .map((card) => renderFactCard(card, '3'))}
                    </div>

                    {/* Stage 4: 캠핑장 주변 (Spot / Hospital / Gas) */}
                    <div className="space-y-3 relative z-10 w-full pl-2">
                        <div className="flex flex-col gap-1 mb-2 ml-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-[#224732] ring-4 ring-white z-10 -ml-[5.5px]" />
                                <span className="text-xs font-bold text-[#224732]">Stage 4. 온전한 힐링 (현지 체류)</span>
                            </div>
                            {plan.stageIntros?.['4'] && (
                                <p className="text-[11px] text-gray-500 italic ml-5 leading-relaxed">"{plan.stageIntros['4']}"</p>
                            )}
                        </div>
                        {/* 힐링 장소 (Spot, Festival) 우선 노출 */}
                        {plan.itemListElement
                            .filter(c => ['SPOT', 'FESTIVAL'].includes(c.category))
                            .map((card) => renderFactCard(card, '4'))}

                        {/* 편의 시설 (Hospital, Gas) 하단 노출 */}
                        {(plan.itemListElement.some(c => ['HOSPITAL', 'GAS_STATION'].includes(c.category))) && (
                            <div className="mt-4 pt-4 border-t-2 border-blue-200 bg-blue-50/30 rounded-xl p-3">
                                <p className="text-[11px] font-bold text-blue-600 mb-3 ml-10 flex items-center gap-1.5">
                                    🛡️ 안전을 위한 편의시설
                                </p>
                                {plan.itemListElement
                                    .filter(c => ['HOSPITAL', 'GAS_STATION'].includes(c.category))
                                    .map((card) => renderFactCard(card, '4'))}
                            </div>
                        )}
                    </div>

                    {/* Stage 5: 안전한 귀가 (Return Trip) */}
                    <div className="space-y-3 relative z-10 w-full pl-2">
                        <div className="flex flex-col gap-1 mb-2 ml-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full border-2 border-dashed border-[#224732] bg-white ring-4 ring-white z-10 -ml-[5.5px]" />
                                <span className="text-xs font-bold text-[#224732]">Stage 5. 아쉬움을 뒤로하고 (귀갓길)</span>
                            </div>
                            {plan.stageIntros?.['5'] && (
                                <p className="text-[11px] text-gray-500 italic ml-5 leading-relaxed">"{plan.stageIntros['5']}"</p>
                            )}
                        </div>
                        {(plan.returnListElement || []).map((card) => renderFactCard(card, '5'))}

                        
                        {/* 여정 종료 마커 */}
                        <div className="flex items-center gap-2 mt-4 ml-4 pb-2">
                            <div className="w-3 h-3 rounded-full border-2 border-dashed border-gray-400 bg-white ring-4 ring-white z-10 -ml-[5.5px]" />
                            <span className="text-[10px] font-semibold text-gray-400">안전하게 집에 도착했습니다.</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Swap / Alternatives Bottom Sheet */}
            <Sheet open={!!swapCategory} onOpenChange={(open) => {
                if (!open) {
                    setSwapCategory(null);
                    setSwapPage(0);
                }
            }}>
                <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto bg-[#F7F5EF] px-4 pb-8">
                    <SheetHeader className="pb-4 border-b border-gray-200">
                        <SheetTitle className="text-left text-lg font-bold text-[#224732]">
                            {swapCategory ? CATEGORY_NAMES[swapCategory] : ''} 일정 교체
                        </SheetTitle>
                        <SheetDescription className="text-left text-xs text-gray-500">
                            캠퍼님의 취향에 맞는 다른 선택지를 골라보세요. (최대 3개 제공)
                        </SheetDescription>
                    </SheetHeader>

                    <div className="py-5 space-y-3">
                        {(() => {
                            const pageSize = 3;
                            const totalPages = Math.ceil(swapOptions.length / pageSize);
                            const paginatedOptions = swapOptions.slice(swapPage * pageSize, (swapPage + 1) * pageSize);

                            return (
                                <>
                                    {paginatedOptions.map((opt, idx) => {
                                        const globalIdx = swapPage * pageSize + idx;
                                        const isCurrentActive = opt.id === (plan.itemListElement.find(c => c.category === swapCategory)?.id || plan.routeListElement?.find(c => c.category === swapCategory)?.id);
                                        return (
                                            <Card
                                                key={opt.id}
                                                className={`cursor-pointer transition-all border ${isCurrentActive ? 'border-[#224732] ring-1 ring-[#224732] shadow-sm bg-[#224732]/5' : 'border-gray-200 hover:border-[#224732]/40 bg-white'}`}
                                                onClick={() => handleSwapOptionSelected(swapCategory!, opt.id)}
                                            >
                                                <CardContent className="p-4 flex items-start gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className="font-bold text-gray-900 text-sm truncate">
                                                                <span className="text-[10px] text-gray-400 mr-1">{globalIdx + 1}위</span>
                                                                {opt.name}
                                                            </h4>
                                                            {isCurrentActive && (
                                                                <span className="text-[9px] bg-[#224732] text-white px-1.5 py-0.5 rounded-sm font-medium tracking-wide">
                                                                    현재 선택됨
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-gray-600 leading-snug line-clamp-1">
                                                            {opt.description}
                                                        </p>
                                                        {opt.reasoning && (
                                                            <p className="text-[10px] text-blue-600 font-medium mt-1 italic">
                                                                " {opt.reasoning} "
                                                            </p>
                                                        )}
                                                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                                            {opt.evidence?.stars && (
                                                                <span className="text-[9px] bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded-md font-bold">
                                                                    ⭐ {opt.evidence.stars.toFixed(1)}
                                                                </span>
                                                            )}
                                                            {opt.evidence?.certifications.map((c, i) => (
                                                                <span key={i} className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md font-bold">
                                                                    {c}
                                                                </span>
                                                            ))}
                                                            <span className="text-[9px] text-gray-400 ml-auto">
                                                                추천도 {opt.trustScore}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {!isCurrentActive && (
                                                        <Button size="sm" variant="outline" className="shrink-0 h-8 text-[11px] rounded-full border-[#224732]/20 text-[#224732] hover:bg-[#224732]/10">
                                                            변경
                                                        </Button>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        );
                                    })}

                                    {/* Pagination Controls */}
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200/60">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setSwapPage(Math.max(0, swapPage - 1))}
                                                disabled={swapPage === 0}
                                                className="text-[#224732]"
                                            >
                                                이전 3개
                                            </Button>
                                            <div className="flex gap-1.5">
                                                {Array.from({ length: totalPages }).map((_, i) => (
                                                    <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === swapPage ? 'bg-[#224732]' : 'bg-gray-300'}`} />
                                                ))}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setSwapPage(Math.min(totalPages - 1, swapPage + 1))}
                                                disabled={swapPage === totalPages - 1}
                                                className="text-[#224732]"
                                            >
                                                다음 3개
                                            </Button>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </SheetContent>
            </Sheet>
            {/* 내비게이션 앱 선택 시트 */}
            <Sheet open={!!navTargetCard} onOpenChange={() => setNavTargetCard(null)}>
                <SheetContent side="bottom" className="rounded-t-3xl p-6">
                    <SheetHeader className="mb-6">
                        <SheetTitle className="text-left flex items-center gap-2">
                            <Navigation className="w-5 h-5 text-blue-600" />
                            길찾기 서비스 선택
                        </SheetTitle>
                        <SheetDescription className="text-left">
                            '{navTargetCard?.name}'(으)로 안내할 앱을 선택해주세요.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="grid grid-cols-3 gap-3 pb-4">
                        <Button
                            variant="outline"
                            className="h-24 flex flex-col gap-2 rounded-2xl border-gray-100 hover:border-yellow-400 hover:bg-yellow-50/30"
                            onClick={() => handleNavChoice('kakao')}
                        >
                            <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-white text-xs font-bold">K</div>
                            <span className="text-[13px] font-bold text-gray-900">카카오맵</span>
                        </Button>
                        <Button
                            variant="outline"
                            className="h-24 flex flex-col gap-2 rounded-2xl border-gray-100 hover:border-yellow-600 hover:bg-yellow-50/50"
                            onClick={() => handleNavChoice('kakaonavi')}
                        >
                            <div className="w-10 h-10 rounded-full bg-[#FFCD00] flex items-center justify-center text-[#3C1E1E] text-xs font-black italic">NAV</div>
                            <span className="text-[13px] font-bold text-gray-900">카카오내비</span>
                        </Button>
                        <Button
                            variant="outline"
                            className="h-24 flex flex-col gap-2 rounded-2xl border-gray-100 hover:border-red-500 hover:bg-red-50/30"
                            onClick={() => handleNavChoice('tmap')}
                        >
                            <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">T</div>
                            <span className="text-[13px] font-bold text-gray-900">티맵</span>
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
