'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Navigation, Map as MapIcon, RefreshCw, ShieldCheck, Heart } from 'lucide-react';
import { generatePersonalizedSmartPlan, StandardizedPlanJSON, FactCard } from '@/lib/smartPlan';
import { dispatchPersonaAction } from '@/lib/persona';

interface SmartPlanProposalProps {
    userId?: string;
    location: { lat: number; lng: number };
    date: Date;
    weatherContext?: string;
    // For demo/UI development purposes without a real backend connection yet
    mockData?: StandardizedPlanJSON;
}

export default function SmartPlanProposal({
    userId,
    location,
    date,
    weatherContext,
    mockData
}: SmartPlanProposalProps) {
    const [plan, setPlan] = useState<StandardizedPlanJSON | null>(mockData || null);
    const [isLoading, setIsLoading] = useState(!mockData);
    const [activeCardId, setActiveCardId] = useState<string | null>(null);

    useEffect(() => {
        if (mockData) return;

        async function fetchPlan() {
            setIsLoading(true);
            try {
                // In a real scenario, we might call an API route here to keep the GEMINI key secure
                // For now, we'll call the engine directly if we're in the frontend (assuming env vars are set)
                // Note: Direct import of generatePersonalizedSmartPlan in a Client Component is risky 
                // in production due to secret leakage if the function isn't purely server-side.
                // We'll proceed with the assumption it works in this sandbox or we'll wrap it in an API route later.
                const generatedPlan = await generatePersonalizedSmartPlan(userId, location, date, weatherContext);
                setPlan(generatedPlan);
                if (generatedPlan.itemListElement.length > 0) {
                    setActiveCardId(generatedPlan.itemListElement[0].id);
                }
            } catch (error) {
                console.error("Failed to fetch smart plan:", error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchPlan();
    }, [userId, location, date, weatherContext, mockData]);

    const handleCardClick = (card: FactCard) => {
        setActiveCardId(card.id);

        // --- [Phase 3.5] Progressive Trigger Injection: Smart Plan Interaction ---
        if (!userId) return;

        // Trigger 36: 추천된 요리 재료 카드를 '간편식/밀키트'로 교체 (Mock logic - tracking click for now)
        if (card.category === 'MART' && card.metadata?.hasMilkit) {
            dispatchPersonaAction(userId, 'PLAN_USE_MILKIT_FILTER').catch(console.error);
        }

        // Trigger 37: 추천된 식당을 '노포'에서 '깔끔/고급 식당'으로 교체
        if (card.category === 'RESTAURANT' && card.metadata?.isHighEnd) {
            dispatchPersonaAction(userId, 'PLAN_USE_HIGHEND_REST').catch(console.error);
        }

        // Trigger 39: 추천된 일정을 '액티비티'에서 '자연산책'으로 교체
        if (card.category === 'SPOT' && card.metadata?.isNatureWalk) {
            dispatchPersonaAction(userId, 'PLAN_USE_NATURE_WALK').catch(console.error);
        }
    };

    const handleNavClick = (e: React.MouseEvent, card: FactCard) => {
        e.stopPropagation(); // Prevent card click
        if (userId) {
            // Trigger 40: 추천 카드 내부 '길찾기(내비게이션)' 버튼 탭
            dispatchPersonaAction(userId, 'PLAN_CLICK_NAVIGATION').catch(console.error);
        }
        window.open(`https://map.kakao.com/link/to/${card.name},${location.lat},${location.lng}`, '_blank');
    };

    if (isLoading) {
        return (
            <div className="w-full flex flex-col items-center justify-center p-8 space-y-4 bg-muted/20 rounded-2xl border border-dashed animate-pulse">
                <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm font-medium text-muted-foreground text-center">
                    캠퍼님의 취향과 주변 정보를 분석하여<br />
                    완벽한 여정을 큐레이션하고 있습니다...
                </p>
            </div>
        );
    }

    if (!plan) return null;

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6">
            {/* Header / Narration Section (Citational UI Top) */}
            <div className="relative p-6 bg-gradient-to-br from-primary/10 via-background to-background rounded-3xl overflow-hidden border">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <MapIcon className="w-32 h-32" />
                </div>

                <div className="relative z-10 space-y-4">
                    <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        <span>AI 스마트 여정 가이드</span>
                    </div>

                    <p className="text-lg leading-relaxed font-medium text-foreground tracking-tight">
                        &quot;{plan.narration}&quot;
                    </p>
                </div>
            </div>

            {/* Fact Cards Section (Citational UI Bottom) */}
            <div className="space-y-4 pt-2">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-2">
                    주변 추천 거점
                </h3>

                <div className="grid gap-3">
                    {plan.itemListElement.map((card) => {
                        const isActive = activeCardId === card.id;

                        return (
                            <Card
                                key={card.id}
                                className={`overflow-hidden transition-all duration-300 cursor-pointer ${isActive
                                    ? 'ring-2 ring-primary shadow-md border-primary/50'
                                    : 'hover:border-primary/30 hover:shadow-sm opacity-90'
                                    }`}
                                onClick={() => handleCardClick(card)}
                            >
                                <CardContent className="p-0">
                                    <div className="p-4 flex gap-4">
                                        {/* Left: Category Icon/Badge */}
                                        <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                                            {card.category === 'MART' && <span className="text-2xl">🛒</span>}
                                            {card.category === 'RESTAURANT' && <span className="text-2xl">🍽️</span>}
                                            {card.category === 'SPOT' && <span className="text-2xl">⛰️</span>}
                                            {card.category === 'HOSPITAL' && <span className="text-2xl">🏥</span>}
                                            {card.category === 'FESTIVAL' && <span className="text-2xl">🎪</span>}
                                        </div>

                                        {/* Right: Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-bold text-base truncate pr-2">{card.name}</h4>
                                                    <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-0.5">
                                                        <span className="flex items-center text-primary/80 font-medium">
                                                            <ShieldCheck className="w-3 h-3 mr-1" />
                                                            신뢰도 {card.trustScore}점
                                                        </span>
                                                        <span>•</span>
                                                        <span>{card.distanceKm}km</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Expandable Details */}
                                            <div
                                                className={`grid transition-all duration-300 ease-in-out ${isActive ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0 mt-0'
                                                    }`}
                                            >
                                                <div className="overflow-hidden">
                                                    <p className="text-sm text-foreground/80 leading-snug">
                                                        {card.description}
                                                    </p>

                                                    {/* Footer Actions */}
                                                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                                                        <span className="text-[10px] text-muted-foreground/60 flex items-center">
                                                            데이터 출처: {card.provenance.sourceName}
                                                        </span>

                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (userId) dispatchPersonaAction(userId, 'PLAN_LIKE_CARD').catch(console.error);
                                                                }}
                                                                className="h-8 px-3 rounded-full border-primary/20 text-primary hover:bg-primary/5"
                                                            >
                                                                <Heart className="w-4 h-4 mr-1.5" />
                                                                저장
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                onClick={(e) => handleNavClick(e, card)}
                                                                className="h-8 px-4 rounded-full shadow-sm"
                                                            >
                                                                <Navigation className="w-4 h-4 mr-1.5" />
                                                                길안내
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            </div>
        </div>
    );
}
