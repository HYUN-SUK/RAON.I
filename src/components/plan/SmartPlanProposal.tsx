'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Navigation, Map as MapIcon, RefreshCw, ShieldCheck, Heart, ArrowRightLeft, MapPin } from 'lucide-react';
import { generatePersonalizedSmartPlan, StandardizedPlanJSON, FactCard } from '@/lib/smartPlan';
import { dispatchPersonaAction } from '@/lib/persona';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

interface SmartPlanProposalProps {
    userId?: string;
    location: { lat: number; lng: number };
    startDate: Date;
    endDate: Date;
    weatherContext?: string;
    mockData?: StandardizedPlanJSON;
}

const CATEGORY_ICONS: Record<string, string> = {
    'ROUTE_CAFE': '☕',
    'MART_HOSPITAL': '🛒',
    'RESTAURANT': '🍽️',
    'SPOT': '📸',
    'FESTIVAL': '🎪'
};

const CATEGORY_NAMES: Record<string, string> = {
    'ROUTE_CAFE': '경로 휴게/카페',
    'MART_HOSPITAL': '마트/편의시설',
    'RESTAURANT': '출출할 때 식사',
    'SPOT': '주변 인생샷 명소',
    'FESTIVAL': '로컬 축제/이벤트'
};

export default function SmartPlanProposal({
    userId,
    location,
    startDate,
    endDate,
    weatherContext,
    mockData
}: SmartPlanProposalProps) {
    const [plan, setPlan] = useState<StandardizedPlanJSON | null>(mockData || null);
    const [isLoading, setIsLoading] = useState(!mockData);
    const [swapCategory, setSwapCategory] = useState<string | null>(null);

    useEffect(() => {
        if (mockData) return;

        async function fetchPlan() {
            setIsLoading(true);
            try {
                const generatedPlan = await generatePersonalizedSmartPlan(userId, location, startDate, endDate, weatherContext);
                setPlan(generatedPlan);
            } catch (error) {
                console.error("Failed to fetch smart plan:", error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchPlan();
    }, [userId, location, startDate, endDate, weatherContext, mockData]);

    const handleSwapOptionSelected = (category: string, newCardId: string) => {
        if (!plan) return;
        const currentActiveInfo = plan.itemListElement.find(c => c.category === category);
        const alternativeCards = plan.alternatives?.[category] || [];
        const newActiveInfo = alternativeCards.find(c => c.id === newCardId);

        if (currentActiveInfo && newActiveInfo) {
            if (userId) {
                // Trigger 36: PLAN_SWAP_MEALKIT (마켓을 밀키트로 변경 등)
                if (newActiveInfo.category === 'MART_HOSPITAL' && newActiveInfo.metadata?.hasMilkit) {
                    dispatchPersonaAction(userId, 'PLAN_SWAP_MEALKIT').catch(console.error);
                }
                // Trigger 37: PLAN_SWAP_FANCY_FOOD
                if (newActiveInfo.category === 'RESTAURANT' && newActiveInfo.metadata?.isHighEnd) {
                    dispatchPersonaAction(userId, 'PLAN_SWAP_FANCY_FOOD').catch(console.error);
                }
                // Trigger 39: PLAN_SWAP_NATURE_WALK
                if (newActiveInfo.category === 'SPOT' && newActiveInfo.metadata?.isNatureWalk) {
                    dispatchPersonaAction(userId, 'PLAN_SWAP_NATURE_WALK').catch(console.error);
                }
                // (Optional fallback) Trigger general filter view
                if (newActiveInfo.metadata?.isScenic) {
                    dispatchPersonaAction(userId, 'PLAN_FILTER_VIEW').catch(console.error);
                }
            }

            const activeIndex = plan.itemListElement.findIndex(c => c.category === category);
            const newActiveList = [...plan.itemListElement];
            newActiveList[activeIndex] = newActiveInfo;

            const newAltsList = alternativeCards.filter(c => c.id !== newCardId);
            newAltsList.push(currentActiveInfo);

            setPlan({
                ...plan,
                itemListElement: newActiveList,
                alternatives: {
                    ...plan.alternatives,
                    [category]: newAltsList
                }
            });
            setSwapCategory(null);
        }
    };

    const handleNavClick = (e: React.MouseEvent, card: FactCard) => {
        e.stopPropagation();
        if (userId) {
            dispatchPersonaAction(userId, 'PLAN_CLICK_NAVI').catch(console.error);
        }
        window.open(`https://map.kakao.com/link/to/${card.name},${location.lat},${location.lng}`, '_blank');
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
        plan.itemListElement.find(c => c.category === swapCategory)!, // Current Active
        ...(plan.alternatives?.[swapCategory] || []) // 2 Alternatives
    ] : [];

    const renderNarration = (text: string) => {
        const regex = /\|\|([^|]+)\|([^|]+)\|\|/g;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex, match.index)}</span>);
            }

            const factId = match[1];
            const placeName = match[2];

            const fact = plan.itemListElement.find(f => f.id === factId) ||
                Object.values(plan.alternatives || {}).flat().find(f => f.id === factId);

            if (fact) {
                parts.push(
                    <span
                        key={`tag-${match.index}`}
                        onClick={(e) => { e.stopPropagation(); setSwapCategory(fact.category); }}
                        className="inline-flex cursor-pointer text-[#F7F5EF] font-bold bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-lg mx-1 transition-colors border-b-2 border-[#F7F5EF]/40 hover:border-[#F7F5EF]"
                    >
                        {placeName}
                    </span>
                );
            } else {
                parts.push(<span key={`text-fallback-${match.index}`}>{placeName}</span>);
            }

            lastIndex = regex.lastIndex;
        }

        if (lastIndex < text.length) {
            parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>);
        }

        return parts.length > 0 ? parts : text;
    };

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6">
            {/* 1. Header & AI Narration Section */}
            <div className="relative p-6 bg-gradient-to-br from-[#224732] via-[#1a3626] to-[#0f2117] rounded-[24px] overflow-hidden shadow-md">
                <div className="absolute -top-4 -right-4 p-4 opacity-10 transform rotate-12">
                    <MapIcon className="w-40 h-40 text-white" />
                </div>

                <div className="relative z-10 space-y-5">
                    <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-semibold tracking-wide backdrop-blur-sm">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                        </span>
                        <span>AI 스마트 여정 가이드</span>
                    </div>

                    <p className="text-lg leading-loose font-medium text-white/90 tracking-tight whitespace-pre-wrap">
                        {renderNarration(plan.narration)}
                    </p>
                </div>
            </div>

            {/* 2. Fact List / Timeline UI */}
            <div className="space-y-4 pt-2">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider px-2 flex items-center justify-between">
                    <span>최종 추천 일정표</span>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">카드를 터치해 일정을 교체하세요</span>
                </h3>

                <div className="grid gap-3 relative before:absolute before:inset-0 before:left-8 before:w-px before:bg-gray-200 before:z-0">
                    {plan.itemListElement.map((card, index) => (
                        <Card
                            key={card.id}
                            className={`relative z-10 overflow-hidden transition-all duration-300 cursor-pointer hover:border-[#224732]/30 hover:shadow-sm border-gray-100/80 bg-white`}
                            onClick={() => setSwapCategory(card.category)}
                        >
                            <CardContent className="p-4">
                                <div className="flex gap-4 items-center">
                                    {/* Icon */}
                                    <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-[#F7F5EF] text-[#224732] flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] text-xl border border-[#224732]/5">
                                        {CATEGORY_ICONS[card.category] || '📍'}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0 pr-2">
                                        <div className="text-[10px] font-bold text-[#224732] mb-0.5">
                                            {CATEGORY_NAMES[card.category] || '추천 장소'}
                                        </div>
                                        <h4 className="font-bold text-gray-900 text-[15px] truncate">{card.name}</h4>
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                                            {card.description}
                                        </p>

                                        <div className="flex items-center space-x-2 text-[10px] text-gray-400 mt-2">
                                            <span className="flex items-center text-[#224732]/70 font-medium bg-[#224732]/5 px-1.5 py-0.5 rounded-sm">
                                                <ShieldCheck className="w-3 h-3 mr-1" />
                                                추천도 {card.trustScore}%
                                            </span>
                                            {card.distanceKm && <span>{card.distanceKm}km 거리</span>}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-2 shrink-0">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={(e) => { e.stopPropagation(); setSwapCategory(card.category); }}
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
                    ))}
                </div>
            </div>

            {/* 3. Swap / Alternatives Bottom Sheet */}
            <Sheet open={!!swapCategory} onOpenChange={(open) => !open && setSwapCategory(null)}>
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
                        {swapOptions.map((opt, idx) => {
                            const isCurrentActive = idx === 0;
                            return (
                                <Card
                                    key={opt.id}
                                    className={`cursor-pointer transition-all border ${isCurrentActive ? 'border-[#224732] ring-1 ring-[#224732] shadow-sm bg-[#224732]/5' : 'border-gray-200 hover:border-[#224732]/40 bg-white'}`}
                                    onClick={() => handleSwapOptionSelected(swapCategory!, opt.id)}
                                >
                                    <CardContent className="p-4 flex items-start gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-bold text-gray-900 text-sm truncate">{opt.name}</h4>
                                                {isCurrentActive && (
                                                    <span className="text-[9px] bg-[#224732] text-white px-1.5 py-0.5 rounded-sm font-medium tracking-wide">
                                                        현재 선택됨
                                                    </span>
                                                )}
                                                {opt.metadata?.isTakeout && <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-sm">포장특화</span>}
                                                {opt.metadata?.hasNightView && <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-sm">야경명소</span>}
                                            </div>
                                            <p className="text-xs text-gray-600 leading-snug">
                                                {opt.description}
                                            </p>
                                            <div className="text-[10px] text-gray-400 mt-2 flex justify-between items-center">
                                                <span>출처: {opt.provenance.sourceName}</span>
                                                <span className="font-medium text-[#224732]/70">추천도 {opt.trustScore}</span>
                                            </div>
                                        </div>
                                        {!isCurrentActive && (
                                            <Button size="sm" variant="outline" className="shrink-0 h-8 text-[11px] rounded-full border-[#224732]/20 text-[#224732] hover:bg-[#224732]/10">
                                                이걸로 변경
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
