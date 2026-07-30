'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Navigation, Map as MapIcon, RefreshCw, ShieldCheck, Heart, ArrowRightLeft, MapPin, Share2, RefreshCcw, Phone } from 'lucide-react';
import { StandardizedPlanJSON, FactCard, ProTimelinePlan } from '@/lib/smartPlan';
import SmartPlanTimelinePro from './SmartPlanTimelinePro';
import { dispatchPersonaAction } from '@/lib/persona';
import { updateSmartPlanData } from '@/actions/schedule';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { toast } from 'sonner';
import RouteSelector from './RouteSelector';
import { openNavApp } from '@/lib/nav-utils';
import { formatPlaceDetailText, getPlacePhoneNumber } from '@/utils/placeFormatter';

interface SmartPlanProposalProps {
    scheduleId?: string;
    initialPlan?: any;
    userId?: string;
    userEmail?: string;
    location: { lat: number; lng: number };
    startDate: Date;
    endDate: Date;
    weatherContext?: string;
    mockData?: StandardizedPlanJSON;
    /** 출발지 좌표 (캠핑 프로필에서 전달). 없으면 브라우저 geolocation fallback */
    origin?: { lat: number; lng: number };
    onReset?: () => void;
    onGenerated?: () => void; // [v11.9.40] 생성 완료 시 호출
    /** PRO 모드 여부 */
    mode?: 'BASIC' | 'PRO';
    /** 여행 타입 (PRO 전용) */
    travelType?: 'camping' | 'general';
    /** 퍼블릭 공유 뷰 모드 여부 (재생성 배너 숨김) */
    isPublicView?: boolean;
    /** 상단 날씨 카드 실시간 수신 데이터 (Silent Sync 연동용) */
    liveWeather?: any;
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
    userEmail,
    location,
    startDate,
    endDate,
    weatherContext,
    mockData,
    origin,
    onReset,
    onGenerated,
    mode = 'BASIC',
    travelType = 'general',
    isPublicView = false,
    liveWeather
}: SmartPlanProposalProps) {
    // [v11.9.52] DB 영구 저장 데이터 복구 로직 (Wrapped Structure 대응)
    const isWrapped = initialPlan?.wrapped === true;
    const initialAiPlan = isWrapped ? initialPlan.ai_plan : initialPlan;
    const initialRoute = isWrapped ? initialPlan.selected_route : null;
    const initialMidpoint = isWrapped ? initialPlan.selected_midpoint : null;
    // PRO 모드 복구: DB에서 mode가 'PRO'이고 부모 컴포넌트가 명시적으로 요청한 모드도 'PRO'인 경우에만 PRO 모드로 복원
    const restoredMode = isWrapped && initialPlan.mode === 'PRO' && mode === 'PRO' ? 'PRO' : mode;
    const restoredTravelType = isWrapped && initialPlan.travel_type ? initialPlan.travel_type : travelType;

    // 만약 restoredMode가 'BASIC'인데 DB 캐시 모드가 'PRO'인 경우(모드 불일치), 호환되지 않는 스키마 데이터의 오작동 방지를 위해 null 처리
    const [plan, setPlan] = useState<StandardizedPlanJSON | null>(
        restoredMode === 'BASIC' && initialPlan?.mode !== 'PRO' ? (initialAiPlan || mockData || null) : null
    );
    const [proPlan, setProPlan] = useState<ProTimelinePlan | null>(
        restoredMode === 'PRO' && initialPlan?.mode === 'PRO' ? initialAiPlan : null
    );
    const [isLoading, setIsLoading] = useState(false);
    const [swapCategory, setSwapCategory] = useState<string | null>(null);
    const [swapPage, setSwapPage] = useState(0);
    const [userOrigin, setUserOrigin] = useState<{ lat: number; lng: number } | undefined>(origin);
    const [selectedMidpoint, setSelectedMidpoint] = useState<{ lat: number; lng: number } | null>(initialMidpoint);
    const [navTargetCard, setNavTargetCard] = useState<FactCard | null>(null);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [swapTargetId, setSwapTargetId] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedRouteData, setSelectedRouteData] = useState<any>(initialRoute);
    const [showRouteNav, setShowRouteNav] = useState(false);
    const [isLocating, setIsLocating] = useState(false); // [v11.9.61] 위치 확인 중 상태
    const [showRegenConfirm, setShowRegenConfirm] = useState(false);
    const [hasTriggeredRegen, setHasTriggeredRegen] = useState(false);
    const [expandedWeatherDate, setExpandedWeatherDate] = useState<string | null>(null);

    // 자동 정렬 타겟 Refs
    const routeSelectorRef = useRef<HTMLDivElement>(null);
    const generatingLoaderRef = useRef<HTMLDivElement>(null);

    // 추천 경로 단계 진입 시 화면 중앙 스크롤
    useEffect(() => {
        if (!plan && !proPlan && userOrigin && !selectedMidpoint && routeSelectorRef.current) {
            routeSelectorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [plan, proPlan, userOrigin, selectedMidpoint]);

    // 계획 조립(로딩) 시 화면 중앙 스크롤
    useEffect(() => {
        if (isGenerating && generatingLoaderRef.current) {
            generatingLoaderRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [isGenerating]);

    // tootg 및 admin 권한 판별용 가드
    const isDeveloper = userEmail === 'tootg@naver.com' || userEmail === 'admin@raon.ai' || process.env.NODE_ENV === 'development';

    // D-3 및 weather_window 확인용 날짜 연산
    const nowKSTForRegen = new Date();
    const todayDateOnlyForRegen = new Date(nowKSTForRegen.getFullYear(), nowKSTForRegen.getMonth(), nowKSTForRegen.getDate());
    const startDateOnlyForRegen = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const diffDaysForRegen = Math.round((startDateOnlyForRegen.getTime() - todayDateOnlyForRegen.getTime()) / (24 * 60 * 60 * 1000));
    const isWithinD3 = diffDaysForRegen <= 3;
    
    // initialPlan의 weather_window 정보 추출 (wrapped 대응)
    const currentWeatherWindow = initialPlan?.weather_window || (initialPlan?.ai_plan?.weather_window);
    const showShortTermRegen = isWithinD3 && initialPlan && currentWeatherWindow !== 'SHORT' && onReset && !hasTriggeredRegen;

    // 1. Get User's Current Location (Origin) — 프로필에서 origin이 제공되면 생략
    useEffect(() => {
        if (origin) {
            setUserOrigin(origin);
            return;
        }
        if (!mockData && typeof window !== 'undefined' && navigator.geolocation) {
            setIsLocating(true);
            
            // [v11.9.61] 20초 타임아웃 설정
            const locTimeout = setTimeout(() => {
                setIsLocating(prev => {
                    return false;
                });
            }, 20000);

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    clearTimeout(locTimeout);
                    setUserOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    setIsLocating(false);
                },
                (err) => {
                    clearTimeout(locTimeout);
                    console.warn("[SmartPlan] Failed to get user location:", err);
                    setIsLocating(false);
                },
                { enableHighAccuracy: true, timeout: 20000 }
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
        // PRO 모드: proPlan이 있으면 스킵
        if (restoredMode === 'PRO' && proPlan) return;
        if (mockData || plan || !selectedMidpoint) return;

        async function fetchPlan() {
            setIsGenerating(true);
            try {
                const res = await fetch('/api/smart-plan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId,
                        location: { lat: locLat, lng: locLng },
                        startDate: startStr,
                        endDate: endStr,
                        origin: originLat && originLng ? { lat: originLat, lng: originLng } : undefined,
                        predefinedMidpoint: selectedMidpoint,
                        mode: restoredMode,
                        travelType: restoredTravelType,
                        routeData: selectedRouteData,
                        prefetchedWeather: liveWeather
                    })
                });
                if (!res.ok) throw new Error(`API Error: ${res.status}`);
                const generatedPlan = await res.json();

                // PRO vs BASIC 분기 저장
                if (generatedPlan.mode === 'PRO') {
                    setProPlan(generatedPlan);
                } else {
                    setPlan(generatedPlan);
                }
                
                // [v11.9.52] AI 플랜과 선택된 경로 데이터를 통합하여 영구 저장
                if (scheduleId) {
                    const weatherWindow = diffDaysForRegen <= 0 ? 'SHORT' : 'MID';
                    const wrappedData = {
                        wrapped: true,
                        mode: restoredMode,
                        travel_type: restoredTravelType,
                        ai_plan: generatedPlan,
                        selected_route: selectedRouteData,
                        selected_midpoint: selectedMidpoint,
                        weather_window: weatherWindow,
                        updated_at: new Date().toISOString()
                    };
                    updateSmartPlanData(scheduleId, wrappedData).catch(console.error);
                }
                if (onGenerated) onGenerated();
            } catch (error) {
                console.error("Failed to fetch smart plan:", error);
                toast.error("플랜 생성에 실패했습니다. 다시 시도해 주세요.");
                setSelectedMidpoint(null);
            } finally {
                setIsGenerating(false);
            }
        }

        fetchPlan();
    }, [userId, locLat, locLng, startStr, endStr, originLat, originLng, mockData, selectedMidpoint, plan, proPlan, scheduleId, selectedRouteData, onGenerated, restoredMode, restoredTravelType]);

    // [v12.7.0] 상단-스마트플랜 묵묵히 실시간 기상 동기화 (Silent Sync)
    useEffect(() => {
        if (!plan || !liveWeather || !liveWeather.daily || !Array.isArray(liveWeather.daily)) return;
        
        if (plan.weatherBriefing && Array.isArray(plan.weatherBriefing.dailyForecasts)) {
            let hasChange = false;
            const updatedDaily = plan.weatherBriefing.dailyForecasts.map((df: any) => {
                if (!df.date) return df;
                // "07/28(화)" -> "0728"
                const cleanDfDate = String(df.date).replace(/[-/]/g, '').replace(/\([^)]*\)/g, '').trim();
                
                const liveMatch = liveWeather.daily.find((d: any) => {
                    if (!d.date) return false;
                    const cleanDDate = String(d.date).replace(/[-/]/g, '').trim();
                    return cleanDDate === cleanDfDate || cleanDDate.endsWith(cleanDfDate) || cleanDfDate.endsWith(cleanDDate);
                });

                if (liveMatch) {
                    const newMin = liveMatch.min !== null && liveMatch.min !== undefined ? Math.round(liveMatch.min) : df.minTemp;
                    const newMax = liveMatch.max !== null && liveMatch.max !== undefined ? Math.round(liveMatch.max) : df.maxTemp;
                    const newPop = liveMatch.pop !== undefined ? liveMatch.pop : df.pop;
                    const newIcon = liveMatch.weatherCode === 'rainy' ? '🌧️' : liveMatch.weatherCode === 'snowy' ? '❄️' : liveMatch.weatherCode === 'cloudy' ? '⛅' : '☀️';

                    if (newMin !== df.minTemp || newMax !== df.maxTemp || newPop !== df.pop || newIcon !== df.skyIcon) {
                        hasChange = true;
                    }
                    return {
                        ...df,
                        minTemp: newMin,
                        maxTemp: newMax,
                        pop: newPop,
                        skyIcon: newIcon
                    };
                }
                return df;
            });

            if (hasChange) {
                setPlan((prev: any) => {
                    if (!prev || !prev.weatherBriefing) return prev;
                    return {
                        ...prev,
                        weatherBriefing: {
                            ...prev.weatherBriefing,
                            dailyForecasts: updatedDaily,
                            avgWindSpeed: liveWeather.windSpeed ?? prev.weatherBriefing.avgWindSpeed,
                            avgHumidity: liveWeather.humidity ?? prev.weatherBriefing.avgHumidity
                        }
                    };
                });
            }
        }
    }, [liveWeather, plan]);

    const handleRouteSelect = (midpoint: { lat: number, lng: number }, routeData: any) => {
        setSelectedMidpoint(midpoint);
        setSelectedRouteData(routeData);
    };

    const handleSwapOptionSelected = (category: string, newCardId: string) => {
        if (!plan) return;
        // [v11.9.32] 카테고리가 아닌 고유 ID(swapTargetId)로 정확한 대상 매칭 (스테이지 2/5 구분 해결)
        const inItemIndex = plan.itemListElement.findIndex(c => c.id === swapTargetId);
        const inRouteIndex = plan.routeListElement?.findIndex(c => c.id === swapTargetId) ?? -1;
        const inReturnIndex = plan.returnListElement?.findIndex(c => c.id === swapTargetId) ?? -1;

        const isRoute = inRouteIndex !== -1;
        const isReturn = inReturnIndex !== -1;
        
        let currentActiveInfo = null;
        if (isRoute && plan.routeListElement) currentActiveInfo = plan.routeListElement[inRouteIndex];
        else if (isReturn && plan.returnListElement) currentActiveInfo = plan.returnListElement[inReturnIndex];
        else if (inItemIndex !== -1) currentActiveInfo = plan.itemListElement[inItemIndex];

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

            // 중복 방지를 위한 안전 장치
            const uniqueAlts = Array.from(new Map(newAltsList.map(c => [c.id, c])).values());
            const updatedPlan = { ...plan, alternatives: { ...plan.alternatives, [category]: uniqueAlts } };

            if (isRoute && updatedPlan.routeListElement) {
                const newRouteList = [...updatedPlan.routeListElement];
                newRouteList[inRouteIndex] = newActiveInfo;
                updatedPlan.routeListElement = newRouteList;
            } else if (isReturn && updatedPlan.returnListElement) {
                const newReturnList = [...updatedPlan.returnListElement];
                newReturnList[inReturnIndex] = newActiveInfo;
                updatedPlan.returnListElement = newReturnList;
            } else if (inItemIndex !== -1) {
                const newActiveList = [...updatedPlan.itemListElement];
                newActiveList[inItemIndex] = newActiveInfo;
                updatedPlan.itemListElement = newActiveList;
            }

            setPlan(updatedPlan);
            if (scheduleId) {
                const weatherWindow = diffDaysForRegen <= 0 ? 'SHORT' : 'MID';
                // [v11.9.53] 카드 교체 시에도 선택된 경로 정보가 누락되지 않도록 래핑하여 저장
                const wrappedData = {
                    wrapped: true,
                    mode: initialPlan?.mode || restoredMode,
                    travel_type: initialPlan?.travel_type || restoredTravelType,
                    ai_plan: updatedPlan,
                    selected_route: selectedRouteData,
                    selected_midpoint: selectedMidpoint,
                    weather_window: initialPlan?.weather_window || weatherWindow,
                    updated_at: new Date().toISOString()
                };
                updateSmartPlanData(scheduleId, wrappedData).catch(console.error);
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
            const address = card.metadata?.address || card.metadata?.addr || '';
            let sigungu = '';
            if (address) {
                const parts = address.trim().split(/\s+/);
                if (parts.length >= 2) {
                    sigungu = parts[1]; // 예: '충청남도 예산군 예산읍' -> '예산군'
                }
            }
            const queryStr = sigungu ? `${sigungu} ${card.name}` : card.name;
            const query = encodeURIComponent(queryStr);
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
        console.log(`[SmartPlan] Opening single card nav: ${app} to ${name}`);
        
        // [v11.9.100] 개별 장소 카드 내비게이션도 통합 유틸 openNavApp 호출로 전격 전환
        openNavApp(app, {
            origin: { name: '현재 위치', lat: 0, lng: 0 },
            destination: { name, lat, lng }
        });

        setNavTargetCard(null);
    };

    const handleShareClick = () => {
        if (userId) {
            dispatchPersonaAction(userId, 'PLAN_SHARE_SNS').catch(console.error);
        }
        
        // 플랜 모드별 대상 추출
        const targetPlan = plan || proPlan;
        
        let placeName = '라온아이';
        if (plan && plan.itemListElement && plan.itemListElement.length > 0) {
            placeName = plan.itemListElement[0].name;
        } else if (proPlan && proPlan.factCards && proPlan.factCards.length > 0) {
            placeName = proPlan.factCards[0].name;
        }

        const planTitle = `🏕️ ${placeName} 캠핑 스마트플랜`;
        const shareText = `${targetPlan?.narration || '행복한 여정을 담은 스마트플랜입니다.'}`;
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const shareUrl = scheduleId ? `${origin}/share/plan/${scheduleId}` : (typeof window !== 'undefined' ? window.location.href : '');

        if (navigator.share) {
            navigator.share({
                title: planTitle,
                text: shareText,
                url: shareUrl,
            }).catch(err => console.error('[SmartPlan] Share error:', err));
        } else {
            // Web Share API가 미지원될 때 클립보드 복사 백업
            const routeSummary = [
                plan?.routeListElement?.length ? `• 가는 길: ${plan.routeListElement.map(r => r.name).join(' → ')}` : '',
                plan?.itemListElement?.length ? `• 주요 일정: ${plan.itemListElement.map(i => i.name).join(', ')}` : '',
                plan?.returnListElement?.length ? `• 복귀 길: ${plan.returnListElement.map(r => r.name).join(' → ')}` : ''
            ].filter(Boolean).join('\n');

            const fullCopyText = `${planTitle}\n일정: ${plan?.target_date || ''}\n\n${shareText}\n\n[주요 방문지]\n${routeSummary}\n\n확인하기: ${shareUrl}`;

            navigator.clipboard.writeText(fullCopyText)
                .then(() => toast.success('클립보드에 플랜 정보가 복사되었어요!'))
                .catch(() => toast.error('공유 복사에 실패했습니다.'));
        }
    };

    if (isGenerating) {
        return (
            <div ref={generatingLoaderRef} className="w-full flex flex-col items-center justify-center p-12 space-y-5 bg-[#F7F5EF] rounded-3xl border border-dashed border-[#224732]/20 shadow-sm animate-pulse m-0">
                <RefreshCw className="w-10 h-10 text-[#224732] animate-spin" />
                <div className="text-center space-y-2">
                    <p className="text-sm font-bold text-[#224732]">
                        여정에 어울리는 장소를 조립하는 중...
                    </p>
                    <p className="text-[11px] text-gray-500">
                        선택하신 경로를 기반으로 정밀 분석을 시작합니다.
                    </p>
                </div>
            </div>
        );
    }

    // 3. Step 1: Route Selection
    if (!plan && !proPlan && userOrigin && !selectedMidpoint) {
        return (
            <div ref={routeSelectorRef} className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                <RouteSelector 
                    origin={userOrigin} 
                    destination={location} 
                    destinationName={initialPlan?.title || initialPlan?.campground_name}
                    onSelect={handleRouteSelect} 
                />
            </div>
        );
    }

    // 3-B. PRO 모드 렌더링
    if (proPlan) {
        return (
            <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Reset 버튼 (개발/tootg 계정 전용) */}
                {isDeveloper && onReset && (
                    <div className="flex justify-end mb-2">
                        <button
                            onClick={onReset}
                            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-400 transition-colors"
                        >
                            <RefreshCcw className="w-3 h-3" />
                            초기화
                        </button>
                    </div>
                )}
                <SmartPlanTimelinePro
                    plan={proPlan}
                    accommodationCoord={location}
                    onPlanUpdate={(updated) => {
                        setProPlan(updated);
                        // DB 영구 저장
                        if (scheduleId) {
                            const wrappedData = {
                                wrapped: true,
                                mode: 'PRO' as const,
                                travel_type: restoredTravelType,
                                ai_plan: updated,
                                selected_route: selectedRouteData,
                                selected_midpoint: selectedMidpoint,
                                updated_at: new Date().toISOString()
                            };
                            updateSmartPlanData(scheduleId, wrappedData).catch(console.error);
                        }
                    }}
                />
            </div>
        );
    }

    if (!plan) return null;

    const swapOptions = swapCategory ? [
        (plan.itemListElement.find(c => c.category === swapCategory) || plan.routeListElement?.find(c => c.category === swapCategory) || plan.returnListElement?.find(c => c.category === swapCategory))!, // Current Active
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
            className={`relative z-10 overflow-hidden transition-all duration-300 cursor-pointer hover:border-[#224732]/30 hover:shadow-sm border-gray-100/80 bg-white w-full`}
            onClick={() => handleCardClick(card)}
        >
            <CardContent className="p-3">
                <div className="flex gap-2 items-start w-full min-w-0">
                    {/* Left Compact Control Area (Touch targets preserved) */}
                    <div className="flex flex-col items-center gap-1 shrink-0 w-10 min-w-[40px] pt-1">
                        {/* Icon */}
                        <div className="w-10 h-10 rounded-xl bg-[#F7F5EF] text-[#224732] flex items-center justify-center shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.03)] text-lg border border-[#224732]/5">
                            {CATEGORY_ICONS[card.category] || '📍'}
                        </div>
                        {/* Swap Button (h-8 w-8 Touch Target Preserved) */}
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setSwapCategory(card.category); 
                                setSwapTargetId(card.id);
                                setSwapPage(0); 
                            }}
                            className="h-8 w-8 rounded-full bg-gray-50 text-gray-500 hover:text-[#224732] hover:bg-[#224732]/10"
                        >
                            <ArrowRightLeft className="w-4 h-4" />
                        </Button>
                        {/* Nav Map Button (h-8 w-8 Touch Target Preserved) */}
                        <Button
                            size="icon"
                            onClick={(e) => handleNavClick(e, card)}
                            className="h-8 w-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 shadow-none border-none"
                        >
                            <MapPin className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Right Info Area (Maximizing width) */}
                    <div className="flex-1 min-w-0 pr-1">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
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

                        <p className="text-xs text-gray-500 mt-1 leading-relaxed whitespace-normal keep-all break-words max-w-full font-medium">
                            {formatPlaceDetailText(card)}
                        </p>
                        {(() => {
                            if (card.category === 'HOSPITAL' && card.metadata?.dutyTel3) {
                                return null;
                            }
                            const tel = getPlacePhoneNumber(card);
                            if (tel) {
                                return (
                                    <div className="mt-1 flex flex-wrap items-center min-w-0 w-full">
                                        <a 
                                            href={`tel:${tel}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="inline-flex flex-wrap items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 active:scale-[0.97] transition-transform underline font-bold whitespace-normal keep-all break-words max-w-full"
                                        >
                                            <Phone className="w-3 h-3 shrink-0" />
                                            방문 전 유선 확인 권장 ({tel.includes('-') ? tel : tel.replace(/[^0-9]/g, '').replace(/(\d{2,3})(\d{3,4})(\d{4})/, '$1-$2-$3')})
                                        </a>
                                    </div>
                                );
                            }
                            if (card.category && card.category !== 'GAS_STATION') {
                                return (
                                    <p className="mt-1 text-[11px] text-amber-600/90 font-bold flex flex-wrap items-center gap-0.5 whitespace-normal keep-all break-words max-w-full min-w-0 animate-pulse">
                                        👉 터치하여 오늘 영업유무 확인권장!
                                    </p>
                                );
                            }
                            return null;
                        })()}

                        {/* [v11.9.25] 한 줄 소개 */}
                        {card.reasoning && (
                            <p className="text-[12px] text-gray-600 mt-0.5 leading-snug italic whitespace-normal keep-all break-words max-w-full min-w-0 pr-2">
                                "{card.reasoning}"
                            </p>
                        )}

                        {/* Fact Chips (v2 Phase 2) - Flex Wrap으로 정돈 */}
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
                            {(card.evidence?.displayBadges || []).map((badge, idx) => (
                                <span key={idx} className="text-[12px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-100 flex items-center justify-center leading-none shadow-sm" title={badge.label}>
                                    {badge.emoji}
                                </span>
                            ))}
                            {card.category === 'GAS_STATION' && card.metadata?.kerosenePrice && (
                                <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md font-bold border border-blue-100 flex items-center gap-1">
                                    <span className="text-[9px] opacity-70">등유</span>
                                    {Number(card.metadata.kerosenePrice).toLocaleString()}원
                                </span>
                            )}
                            {card.category === 'HOSPITAL' && (
                                <>
                                    {card.metadata?.hvec !== undefined && parseInt(card.metadata.hvec) > 0 && (
                                        <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-md font-bold border border-green-100/50 flex items-center gap-1 shadow-sm">
                                            🟢 일반 {card.metadata.hvec}석 여유
                                        </span>
                                    )}
                                    {card.metadata?.hvs01 !== undefined && parseInt(card.metadata.hvs01) > 0 && (
                                        <span className="text-[10px] bg-[#e0f2fe] text-[#0369a1] px-1.5 py-0.5 rounded-md font-bold border border-[#bae6fd] flex items-center gap-1 shadow-sm">
                                            👶 소아 {card.metadata.hvs01}석 여유
                                        </span>
                                    )}
                                </>
                            )}
                            {!['2', '5'].includes(stage || '') && card.distanceKm && (
                                <span className="text-[10px] text-gray-400 font-medium">
                                    📍 {card.distanceKm}km 거리
                                </span>
                            )}
                        </div>
                        {card.category === 'HOSPITAL' && card.metadata?.dutyTel3 && (
                            <div className="mt-2.5">
                                <Button
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        window.location.href = `tel:${card.metadata.dutyTel3}`;
                                    }}
                                    className="h-7 w-full md:w-auto bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 shadow-none border border-rose-200/50 flex items-center justify-center gap-1.5 text-[11px] font-black rounded-lg whitespace-normal keep-all break-words"
                                >
                                    <Phone className="w-3 h-3 shrink-0" />
                                    응급실 직통전화 ({card.metadata.dutyTel3})
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    const showNoWeatherBanner = !isPublicView && diffDaysForRegen >= 8;
    const showMidTermActionBanner = !isPublicView && diffDaysForRegen >= 1 && diffDaysForRegen <= 7 && currentWeatherWindow !== 'MID' && currentWeatherWindow !== 'SHORT' && onReset;
    const showMidTermStaticBanner = false; // 8일 전 이상은 showNoWeatherBanner가 통합 처리
    const showShortTermActionBanner = !isPublicView && diffDaysForRegen <= 0 && initialPlan && currentWeatherWindow !== 'SHORT' && onReset && !hasTriggeredRegen;

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6">
            {showNoWeatherBanner && (
                <div className="bg-blue-50/95 border border-blue-200/70 rounded-2xl p-4 flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                    <span className="text-xl shrink-0">📅</span>
                    <div className="flex flex-col min-w-0">
                        <p className="text-[13px] font-bold text-blue-900 leading-normal">
                            날씨 정보가 아직 준비되지 않았습니다.
                        </p>
                        <p className="text-[11px] text-blue-700 leading-normal mt-0.5 font-medium">
                            여행 7일 전부터 주간 날씨 정보가 채워지며, 초정밀 실시간 예보는 출발 당일부터 반영됩니다. 조금만 기다려주세요!
                        </p>
                    </div>
                </div>
            )}

            {showMidTermActionBanner && (
                <div className="bg-[#fcf8e3]/95 border border-amber-300/60 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl shrink-0">🌤️</span>
                        <div className="flex flex-col min-w-0">
                            <p className="text-[13px] font-bold text-amber-900 leading-normal">
                                주간 예보 정보가 준비되었습니다!
                            </p>
                            <p className="text-[11px] text-amber-700/90 leading-normal mt-0.5 font-medium">
                                체크인 7일 전부터 제공되는 기상청 주간 날씨에 맞추어 캠핑 일정을 첫 번째로 최신화해 보세요.
                            </p>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            setPlan(null);
                            setSelectedMidpoint(null);
                            setSelectedRouteData(null);
                            onReset();
                        }}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black h-8 px-3.5 rounded-xl shrink-0 flex items-center gap-1 active:scale-95 transition-transform shadow-sm border border-amber-500/20"
                    >
                        <RefreshCw className="w-3 h-3" />
                        업데이트 받기
                    </Button>
                </div>
            )}

            {showShortTermActionBanner && (
                <div className="bg-gradient-to-r from-emerald-50 via-emerald-50/90 to-green-50/80 border border-green-300/50 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-out" />
                    <div className="flex items-center gap-3 min-w-0 z-10">
                        <span className="text-xl shrink-0 animate-bounce">⚡</span>
                        <div className="flex flex-col min-w-0">
                            <p className="text-[13px] font-bold text-green-900 leading-normal">
                                드디어 캠핑 출발 당일! 실시간 기상 정보가 완성되었습니다.
                            </p>
                            <p className="text-[11px] text-green-700 leading-normal mt-0.5 font-medium">
                                마지막 퇴실/철수일 예보까지 모두 개방된 100% 정확한 기상청 풍속 및 습도를 바탕으로 완벽한 계획을 받아보세요.
                            </p>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            setHasTriggeredRegen(true);
                            setPlan(null);
                            setSelectedMidpoint(null);
                            setSelectedRouteData(null);
                            onReset();
                        }}
                        className="bg-green-700 hover:bg-green-800 text-white text-[11px] font-black h-8 px-3.5 rounded-xl shrink-0 flex items-center gap-1 active:scale-95 transition-transform shadow-md z-10 border border-green-600/20"
                    >
                        <RefreshCw className="w-3 h-3 animate-spin duration-1000" />
                        업데이트 받기
                    </Button>
                </div>
            )}

            {/* 1. Header & AI Narration Section */}
            <div className="relative p-6 bg-gradient-to-br from-[#224732] via-[#1a3626] to-[#0f2117] rounded-[24px] overflow-hidden shadow-md">
                <div className="absolute -top-4 -right-4 p-4 opacity-10 transform rotate-12">
                    <MapIcon className="w-40 h-40 text-white" />
                </div>

                <div className="relative pt-6 pb-12 px-6">
                    {/* 개발자 리셋 기어 아이콘 유지 */}
                    {isDeveloper && onReset && !showShortTermActionBanner && !showMidTermActionBanner && (
                        <div className="absolute top-6 right-6 z-30 flex items-center">
                            {showResetConfirm ? (
                                <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-2 py-1.5 rounded-xl border border-[#224732]/20 shadow-xl animate-in fade-in zoom-in duration-200">
                                    <span className="text-[10px] font-bold text-[#224732] px-1">재구성할까요?</span>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowResetConfirm(false);
                                            setPlan(null);
                                            setSelectedMidpoint(null);
                                            setSelectedRouteData(null);
                                            onReset();
                                        }}
                                        className="text-[10px] px-2.5 py-1.5 bg-[#224732] text-white rounded-lg font-bold hover:bg-[#1a3626]"
                                    >
                                        네
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowResetConfirm(false);
                                        }}
                                        className="text-[10px] px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded-lg font-bold hover:bg-gray-200"
                                    >
                                        아니오
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowResetConfirm(true);
                                    }}
                                    className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl border border-white/10 transition-all active:scale-95 group"
                                    title="플랜 재구성 (실험용)"
                                >
                                    <RefreshCcw className="w-5 h-5 text-white/80 group-hover:text-white transition-transform group-hover:rotate-180 duration-700" />
                                </button>
                            )}
                        </div>
                    )}
                    <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-semibold tracking-wide backdrop-blur-sm">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                        </span>
                        <span>라온아이 스마트 여정 가이드</span>
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

                    {/* [v12.6.0] 날씨 브리핑 카드 UI */}
                    {plan.weatherBriefing && (
                        <div className="mt-4 -mx-3.5 sm:mx-0 p-3 sm:p-4 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-sm text-white overflow-hidden">
                            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                                <div className="flex items-center gap-2 font-bold text-sm text-emerald-300">
                                    <span>🌤️</span>
                                    <span>날씨 브리핑</span>
                                </div>
                                <span className="text-xs font-semibold text-white/80 bg-white/15 px-2.5 py-0.5 rounded-full">
                                    {plan.weatherBriefing.dDay > 0 ? `D-${plan.weatherBriefing.dDay}` : plan.weatherBriefing.dDay === 0 ? 'D-Day' : `D+${Math.abs(plan.weatherBriefing.dDay)}`}
                                </span>
                            </div>

                            {plan.weatherBriefing.status === 'UNAVAILABLE' ? (
                                <p className="text-xs text-white/70 italic">
                                    출발일이 아직 넉넉히 남아 날씨 정보는 예보 도달 시(D-7 이내) 자동으로 업데이트됩니다.
                                </p>
                            ) : (
                                <div className="space-y-2.5">
                                    {/* 일별 요약 리스트 */}
                                    {plan.weatherBriefing.dailyForecasts.map((df, idx) => {
                                        const hasHourly = plan.weatherBriefing?.hourlyDetails && plan.weatherBriefing.hourlyDetails.some(h => h.date === df.date);
                                        const isExpanded = expandedWeatherDate === df.date;

                                        return (
                                            <div key={idx} className="flex flex-col gap-1">
                                                <div 
                                                    onClick={() => {
                                                        if (hasHourly) {
                                                            setExpandedWeatherDate(isExpanded ? null : df.date);
                                                        }
                                                    }}
                                                    className={`flex flex-col text-xs font-medium px-3 py-2.5 rounded-xl border transition-all ${
                                                        hasHourly ? 'cursor-pointer hover:bg-black/25 active:scale-[0.99]' : ''
                                                    } ${isExpanded ? 'bg-black/30 border-white/20' : 'bg-black/15 border-white/5'}`}
                                                >
                                                    {/* 데드센터 3컬럼 레이아웃 (좌측: 날짜 / 중앙: 핵심날씨+최저기온 중심축 / 우측: 강수확률) */}
                                                    <div className="grid grid-cols-12 items-center w-full">
                                                        <span className="col-span-4 font-semibold text-white/90 whitespace-nowrap text-left text-xs">
                                                            📅 {df.date}{df.dayOfWeek ? `(${df.dayOfWeek})` : ''}
                                                        </span>
                                                        <div className="col-span-5 flex items-center justify-center gap-1 font-bold text-emerald-200 text-xs whitespace-nowrap">
                                                            <span className="text-sm">{df.skyIcon}</span>
                                                            <span>{df.minTemp}~{df.maxTemp}°C</span>
                                                        </div>
                                                        <div className="col-span-3 flex items-center justify-end">
                                                            {df.pop > 0 ? (
                                                                <span className="text-cyan-200 text-[11px] font-semibold bg-cyan-950/50 px-1.5 py-0.5 rounded border border-cyan-400/30 whitespace-nowrap">
                                                                    ☔ {df.pop}%
                                                                </span>
                                                            ) : (
                                                                <span className="text-white/30 text-[10px]">-</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* 카드 내부 하단 중앙 화살표 (hasHourly일 경우) */}
                                                    {hasHourly && (
                                                        <div className="flex justify-center pt-1.5 pb-0 text-[11px] font-bold text-amber-300 animate-pulse select-none">
                                                            {isExpanded ? '▲' : '▼'}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* 터치 시 펼쳐지는 시간대별 이모지 날씨 (시간, 이모지, 온도, 풍향+풍속, 습도) */}
                                                {isExpanded && hasHourly && plan.weatherBriefing?.hourlyDetails && (
                                                    <div className="p-2.5 text-xs text-white/90 flex flex-wrap gap-2 bg-black/30 rounded-xl border border-white/10 my-1 animate-fadeIn">
                                                        {plan.weatherBriefing.hourlyDetails
                                                            .filter(h => h.date === df.date)
                                                            .map((h, hIdx) => {
                                                                const dirLabel = h.windDir ? (h.windDir.endsWith('풍') ? h.windDir.slice(0, -1) : h.windDir) : '남동';
                                                                return (
                                                                    <div key={hIdx} className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-white/10 shadow-sm whitespace-nowrap">
                                                                        <span className="text-white/60 font-semibold">{h.hour}</span>
                                                                        <span className="text-xs">{h.skyIcon || (h.sky === '비' ? '🌧️' : h.sky === '구름많음' ? '⛅' : h.sky === '흐림' ? '☁️' : '☀️')}</span>
                                                                        <span className="font-bold text-white ml-0.5">{h.temp}°C</span>
                                                                        {h.windSpeed != null && (
                                                                            <span className="text-[10px] text-white/80 ml-0.5">
                                                                                💨 {dirLabel} {h.windSpeed}m/s
                                                                            </span>
                                                                        )}
                                                                        {h.humidity != null && <span className="text-[10px] text-cyan-200 ml-0.5">💧 {h.humidity}%</span>}
                                                                    </div>
                                                                );
                                                            })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* 하단 3대 기상 요약 (평균풍속, 최대풍속(방향), 평균습도) 또는 중기예보 안내 */}
                                    {plan.weatherBriefing.status === 'DETAILED' && (plan.weatherBriefing.avgWindSpeed != null || plan.weatherBriefing.avgHumidity != null) ? (
                                        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-white/80 px-0.5">
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                {plan.weatherBriefing.avgWindSpeed != null && (
                                                    <span>💨 평균풍속 {plan.weatherBriefing.avgWindSpeed > 0 ? `${plan.weatherBriefing.avgWindSpeed}m/s` : '선선'}</span>
                                                )}
                                                {plan.weatherBriefing.maxWindSpeed != null && (
                                                    <span>
                                                        🌪️ 최대풍속 {plan.weatherBriefing.maxWindSpeed}m/s({plan.weatherBriefing.windDirection ? (plan.weatherBriefing.windDirection.endsWith('풍') ? plan.weatherBriefing.windDirection : plan.weatherBriefing.windDirection + '풍') : '남서풍'})
                                                    </span>
                                                )}
                                                {plan.weatherBriefing.avgHumidity != null && (
                                                    <span>💧 평균습도 {plan.weatherBriefing.avgHumidity}%</span>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="pt-2 border-t border-white/10 flex items-center gap-1.5 text-[11px] text-amber-200/90 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-400/20">
                                            <span>ℹ️</span>
                                            <span>중기예보는 기온/강수확률 중심으로 제공됩니다</span>
                                        </div>
                                    )}

                                    {/* ⚠️ 날씨 흐름 알림 (있을 경우) */}
                                    {plan.weatherBriefing.flowAlert && (
                                        <div className="mt-2 text-xs font-semibold text-amber-300 bg-amber-500/20 border border-amber-400/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                                            <span>⚠️</span>
                                            <span>{plan.weatherBriefing.flowAlert}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
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

                    {/* [v11.9.45] 전체 여정 내비게이션 연결 버튼 */}
                    {plan && selectedRouteData && (
                        <div className="mt-6 pt-6 border-t border-white/10">
                            <Button
                                onClick={() => setShowRouteNav(true)}
                                className="w-full h-14 bg-white text-[#224732] hover:bg-white/90 rounded-2xl font-black text-lg shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all group"
                            >
                                <div className="w-8 h-8 rounded-full bg-[#224732]/10 flex items-center justify-center">
                                    <Navigation className="w-5 h-5 text-[#224732] group-hover:animate-bounce" />
                                </div>
                                여정 시작: 내비게이션 연결
                            </Button>
                            <p className="text-[10px] text-white/50 text-center mt-3 font-medium">
                                선택하신 {Math.floor(selectedRouteData.summary.duration / 60)}분 경로로 안내를 시작합니다.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* 2. Fact List / 5-Stage Emotional Timeline UI */}
            <div className="space-y-6 pt-2 overflow-x-hidden">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-4 flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between min-w-0">
                    <span>{plan.target_date || ''} 최종 추천 일정표</span>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full w-fit">카드를 터치해 일정을 교체하세요</span>
                </h3>

                <div className="grid grid-cols-1 gap-8 relative before:absolute before:inset-0 before:left-[10px] md:before:left-[10px] before:w-0.5 before:bg-[#224732]/10 before:z-0 w-full min-w-0">

                    {/* Stage 1: 출발 (Intro) */}
                    <div className="space-y-3 relative z-10 w-full">
                        <div className="flex flex-col gap-1 mb-2 ml-4 min-w-0">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full border-2 border-[#224732] bg-white ring-4 ring-white z-10 -ml-[6px]" />
                                <span className="text-xs font-bold text-[#224732]">Stage 1. 설레는 출발</span>
                            </div>
                            {plan.stage1_timeline && (
                                <p className="text-[11px] text-gray-500 italic ml-5 leading-relaxed pr-3 whitespace-normal break-words mr-4 min-w-0">"{plan.stage1_timeline}"</p>
                            )}
                        </div>
                    </div>

                    {/* Stage 2: 가는 길 (Route Facts) */}
                    {(plan.routeListElement || []).length > 0 && (
                        <div className="space-y-3 relative z-10 w-full min-w-0">
                            <div className="flex flex-col gap-1 mb-2 ml-4 min-w-0">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-[#224732] ring-4 ring-white z-10 -ml-[6px]" />
                                    <span className="text-xs font-bold text-[#224732]">Stage 2. 여정의 즐거움 (경유지)</span>
                                </div>
                                {plan.stageIntros?.['2'] && (
                                    <p className="text-[11px] text-gray-500 italic ml-5 leading-relaxed pr-3 whitespace-normal break-all mr-4 min-w-0">"{plan.stageIntros['2']}"</p>
                                )}
                            </div>
                            <div className="px-2 space-y-3 w-full min-w-0">
                                {plan.routeListElement?.map((card) => renderFactCard(card, '2'))}
                            </div>
                        </div>
                    )}

                    {/* Stage 3: 캠프 준비 (Mart / Restaurant) */}
                    <div className="space-y-3 relative z-10 w-full min-w-0">
                        <div className="flex flex-col gap-1 mb-2 ml-4 min-w-0">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-[#224732] ring-4 ring-white z-10 -ml-[6px]" />
                                <span className="text-xs font-bold text-[#224732]">Stage 3. 든든한 준비 (식사/장보기)</span>
                            </div>
                            {plan.stageIntros?.['3'] && (
                                <p className="text-[11px] text-gray-500 italic ml-5 leading-relaxed pr-3 whitespace-normal break-all mr-4 min-w-0">"{plan.stageIntros['3']}"</p>
                            )}
                        </div>
                        <div className="px-2 space-y-3 w-full min-w-0">
                            {plan.itemListElement
                                .filter(c => ['MART', 'RESTAURANT'].includes(c.category))
                                .map((card) => renderFactCard(card, '3'))}
                        </div>
                    </div>

                    {/* Stage 4: 캠핑장 주변 (Spot / Hospital / Gas) */}
                    <div className="space-y-3 relative z-10 w-full">
                        <div className="flex flex-col gap-1 mb-2 ml-4 min-w-0">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-[#224732] ring-4 ring-white z-10 -ml-[6px]" />
                                <span className="text-xs font-bold text-[#224732]">Stage 4. 온전한 힐링 (현지 체류)</span>
                            </div>
                            {plan.stageIntros?.['4'] && (
                                <p className="text-[11px] text-gray-500 italic ml-5 leading-relaxed pr-3 whitespace-normal break-words mr-4 min-w-0">"{plan.stageIntros['4']}"</p>
                            )}
                        </div>
                        {/* 힐링 장소 (Spot, Festival) 우선 노출 */}
                        <div className="px-4 space-y-3">
                            {plan.itemListElement
                                .filter(c => ['SPOT', 'FESTIVAL'].includes(c.category))
                                .map((card) => renderFactCard(card, '4'))}
                        </div>

                        {/* 편의 시설 (Hospital, Gas) 하단 노출 */}
                        {(plan.itemListElement.some(c => ['HOSPITAL', 'GAS_STATION'].includes(c.category))) && (
                            <div className="mt-4 pt-4 border-t-2 border-blue-200 bg-blue-50/30 rounded-xl py-3 px-0 mx-0 min-w-0">
                                <p className="text-[11px] font-bold text-blue-600 mb-3 ml-4 flex items-center gap-1.5">
                                    🛡️ 안전을 위한 편의시설
                                </p>
                                {plan.itemListElement
                                    .filter(c => ['HOSPITAL', 'GAS_STATION'].includes(c.category))
                                    .map((card) => renderFactCard(card, '4'))}
                            </div>
                        )}
                    </div>

                    {/* Stage 5: 안전한 귀가 (Return Trip) */}
                    <div className="space-y-3 relative z-10 w-full min-w-0">
                        <div className="flex flex-col gap-1 mb-2 ml-4 min-w-0">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full border-2 border-dashed border-[#224732] bg-white ring-4 ring-white z-10 -ml-[6px]" />
                                <span className="text-xs font-bold text-[#224732]">Stage 5. 아쉬움을 뒤로하고 (귀갓길)</span>
                            </div>
                            {plan.stageIntros?.['5'] && (
                                <p className="text-[11px] text-gray-500 italic ml-[38px] leading-relaxed pr-3 whitespace-normal break-words mr-4 min-w-0">"{plan.stageIntros['5']}"</p>
                            )}
                        </div>
                        <div className="px-2 space-y-3 w-full min-w-0">
                            {(plan.returnListElement || []).map((card) => renderFactCard(card, '5'))}
                        </div>

                        
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
                            캠퍼님의 취향에 맞는 다른 선택지를 골라보세요.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="py-5 space-y-4">
                        {(() => {
                            if (!swapCategory) return null;
                            const currentActive = plan.itemListElement?.find(c => c.id === swapTargetId) || 
                                                 plan.routeListElement?.find(c => c.id === swapTargetId) || 
                                                 plan.returnListElement?.find(c => c.id === swapTargetId);
                            
                            const rawAlternatives = plan.alternatives?.[swapCategory] || [];
                            
                            const getDistHelper = (lat1: number, lng1: number, lat2: number, lng2: number) => {
                                const R = 6371e3;
                                const f1 = lat1 * Math.PI/180, f2 = lat2 * Math.PI/180;
                                const df = (lat2-lat1) * Math.PI/180, dl = (lng2-lng1) * Math.PI/180;
                                const a = Math.sin(df/2) * Math.sin(df/2) + Math.cos(f1) * Math.cos(f2) * Math.sin(dl/2) * Math.sin(dl/2);
                                return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                            };
                            const cleanStrHelper = (s: string) => (s || '').replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').replace(/\s/g, '').toLowerCase();

                            // [v12.5.5] 클라이언트 단 대안 리스트 자체 공간 중복 제거 가드 추가 (이름 무관 50m 초근접 소거)
                            const deduplicateSpatialClient = (cards: any[]): any[] => {
                                const result: any[] = [];
                                for (const card of cards) {
                                    let isDup = false;
                                    const cName = cleanStrHelper(card.name);
                                    for (const existing of result) {
                                        const dist = getDistHelper(card.lat, card.lng, existing.lat, existing.lng);
                                        const extName = cleanStrHelper(existing.name);
                                        
                                        const isSpatialDup = dist < 50 || (dist < 500 && (cName.includes(extName) || extName.includes(cName)));
                                        if (isSpatialDup) {
                                            isDup = true;
                                            if (card.trustScore > existing.trustScore) {
                                                Object.assign(existing, card);
                                            }
                                            break;
                                        }
                                    }
                                    if (!isDup) {
                                        result.push(card);
                                    }
                                }
                                return result;
                            };

                            const uniqueAlternatives = deduplicateSpatialClient(rawAlternatives);

                            // [v12.5.4] 클라이언트 단 교차 공간 중복 제거 및 PRO/BASIC 모드 호환 적용
                            const activeCards = (plan as any).mode === 'PRO'
                                ? ((plan as any).factCards || [])
                                : [
                                    ...(plan.itemListElement || []),
                                    ...(plan.routeListElement || []),
                                    ...(plan.returnListElement || [])
                                  ];
                            
                            const activeIds = activeCards.map((c: any) => c.id);

                            const availableAlternatives = uniqueAlternatives.filter(c => {
                                if (activeIds.includes(c.id)) return false;

                                const cName = cleanStrHelper(c.name);
                                if (!cName) return false;

                                const isSpatialDup = activeCards.some((actCard: any) => {
                                    const dist = getDistHelper(c.lat, c.lng, actCard.lat, actCard.lng);
                                    const actName = cleanStrHelper(actCard.name);
                                    if (!actName) return false;
                                    return dist < 50 || (dist < 500 && (cName.includes(actName) || actName.includes(cName)));
                                });
                                return !isSpatialDup;
                            });

                            const allOptions = currentActive ? [currentActive, ...availableAlternatives] : availableAlternatives;
                            
                            const pageSize = 3;
                            const totalPages = Math.ceil(allOptions.length / pageSize);
                            const paginatedOptions = allOptions.slice(swapPage * pageSize, (swapPage + 1) * pageSize);

                            return (
                                <>
                                    {/* 추천 후보 리스트 (3개 1묶음 페이지 단위 스와이프) [v11.9.56] */}
                                    <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-6 px-6 gap-6 pb-4">
                                        {(() => {
                                            const chunks = [];
                                            for (let i = 0; i < allOptions.length; i += 3) {
                                                chunks.push(allOptions.slice(i, i + 3));
                                            }
                                            
                                            return chunks.map((chunk, chunkIdx) => (
                                                <div key={chunkIdx} className="snap-center shrink-0 w-[88vw] space-y-3">
                                                    {chunk.map((opt, idx) => {
                                                        const globalIdx = chunkIdx * 3 + idx;
                                                        const isCurrentActive = opt.id === currentActive?.id;
                                                        return (
                                                            <Card
                                                                key={opt.id}
                                                                className={`transition-all border shadow-none ${isCurrentActive ? 'border-[#224732] ring-1 ring-[#224732] bg-[#224732]/5' : 'border-gray-100 bg-white'}`}
                                                                onClick={() => handleSwapOptionSelected(swapCategory!, opt.id)}
                                                            >
                                                                <CardContent className="p-3 flex items-start gap-3">
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <h4 className="font-bold text-gray-900 text-[13px] truncate">
                                                                                <span className="text-[10px] text-gray-400 mr-1">{globalIdx + 1}위</span>
                                                                                {opt.name}
                                                                            </h4>
                                                                            {isCurrentActive && (
                                                                                <span className="text-[9px] bg-[#224732] text-white px-1.5 py-0.5 rounded-sm font-medium">현재 선택됨</span>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-[11px] text-gray-500 line-clamp-1 mb-1 font-medium">{formatPlaceDetailText(opt)}</p>
                                                                        {(() => {
                                                                            if (opt.category === 'HOSPITAL' && opt.metadata?.dutyTel3) {
                                                                                return null;
                                                                            }
                                                                            const tel = getPlacePhoneNumber(opt);
                                                                            if (tel) {
                                                                                return (
                                                                                    <div className="mb-1">
                                                                                        <a 
                                                                                            href={`tel:${tel}`}
                                                                                            onClick={(e) => e.stopPropagation()}
                                                                                            className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 active:scale-[0.97] transition-transform underline font-bold"
                                                                                        >
                                                                                            <Phone className="w-2.5 h-2.5" />
                                                                                            유선 확인 권장 ({tel.includes('-') ? tel : tel.replace(/[^0-9]/g, '').replace(/(\d{2,3})(\d{3,4})(\d{4})/, '$1-$2-$3')})
                                                                                        </a>
                                                                                    </div>
                                                                                );
                                                                            }
                                                                            if (opt.category && opt.category !== 'GAS_STATION') {
                                                                                return (
                                                                                    <p className="mb-1 text-[10px] text-amber-600/90 font-bold flex items-center gap-0.5 animate-pulse">
                                                                                        👉 터치하여 오늘 영업유무 확인권장!
                                                                                    </p>
                                                                                );
                                                                            }
                                                                            return null;
                                                                        })()}
                                                                        {opt.reasoning && (
                                                                            <p className="text-[10px] text-blue-600 font-semibold mb-2 leading-tight">
                                                                                <span className="opacity-60 mr-1">AI Pick:</span>
                                                                                "{opt.reasoning}"
                                                                            </p>
                                                                        )}
                                                                        
                                                                        {/* [v11.9.56] 인증정보 및 가격 배지 복구/통합 */}
                                                                        <div className="flex flex-wrap items-center gap-1">
                                                                            {opt.evidence?.stars && (
                                                                                <span className="text-[9px] bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded-md font-bold border border-yellow-100/30">⭐ {opt.evidence.stars.toFixed(1)}</span>
                                                                            )}
                                                                            {opt.evidence?.certifications.map((c: any, i: number) => (
                                                                                <span key={i} className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md font-bold border border-blue-100/30">{c}</span>
                                                                            ))}
                                                                            {opt.category === 'GAS_STATION' && (opt.metadata?.kerosenePrice || opt.description?.match(/등유:\s?(\d+)원/)) && (() => {
                                                                                const price = opt.metadata?.kerosenePrice || opt.description?.match(/등유:\s?(\d+)원/)?.[1];
                                                                                return price ? (
                                                                                    <span className="text-[9px] bg-[#224732]/5 text-[#224732] px-1.5 py-0.5 rounded-md font-bold border border-[#224732]/10 flex items-center gap-1">
                                                                                        <span className="text-[8px] opacity-70">등유</span>
                                                                                        {Number(price).toLocaleString()}원
                                                                                    </span>
                                                                                ) : null;
                                                                            })()}
                                                                            {/* [v11.9.10] 실시간 병상 정보 배지 */}
                                                                            {opt.category === 'HOSPITAL' && (
                                                                                <>
                                                                                    {opt.metadata?.hvec !== undefined && parseInt(opt.metadata.hvec) > 0 && (
                                                                                        <span className="text-[9px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-md font-bold border border-green-100/30">🟢 일반 {opt.metadata.hvec}석</span>
                                                                                    )}
                                                                                    {opt.metadata?.hvs01 !== undefined && parseInt(opt.metadata.hvs01) > 0 && (
                                                                                        <span className="text-[9px] bg-[#e0f2fe] text-[#0369a1] px-1.5 py-0.5 rounded-md font-bold border border-[#bae6fd]">👶 소아 {opt.metadata.hvs01}석</span>
                                                                                    )}
                                                                                </>
                                                                            )}
                                                                            <span className="text-[9px] text-gray-400 ml-auto font-medium">Score {opt.trustScore}</span>
                                                                        </div>
                                                                        {opt.category === 'HOSPITAL' && opt.metadata?.dutyTel3 && (
                                                                            <div className="mt-1.5">
                                                                                <Button
                                                                                    size="sm"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        window.open(`tel:${opt.metadata.dutyTel3}`);
                                                                                    }}
                                                                                    className="h-6 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 shadow-none border border-rose-200/50 flex items-center gap-1 text-[9px] font-black rounded-md px-2"
                                                                                >
                                                                                    <Phone className="w-2.5 h-2.5" />
                                                                                    직통전화 {opt.metadata.dutyTel3}
                                                                                </Button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {!isCurrentActive && (
                                                                        <Button size="sm" variant="outline" className="shrink-0 h-7 px-2 text-[10px] rounded-full border-[#224732]/20 text-[#224732] hover:bg-[#224732]/10">변경</Button>
                                                                    )}
                                                                </CardContent>
                                                            </Card>
                                                        );
                                                    })}
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                    
                                    <div className="flex justify-center gap-1.5 mt-2 mb-4 overflow-hidden">
                                        {Array.from({ length: Math.ceil(allOptions.length / 3) }).slice(0, 5).map((_, i) => (
                                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                                        ))}
                                    </div>
                                    <p className="text-center text-[10px] text-gray-400 italic">← 옆으로 밀어서 다음 추천(3개씩)을 확인하세요 →</p>
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
                            className="h-24 flex flex-col gap-2 rounded-2xl border-gray-100 hover:border-blue-600 hover:bg-blue-50/30"
                            onClick={() => handleNavChoice('tmap')}
                        >
                            <div className="w-10 h-10 rounded-full bg-[#FF4500] flex items-center justify-center text-white text-[10px] font-black">TMAP</div>
                            <span className="text-[13px] font-bold text-gray-900">T맵</span>
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>

            {/* [v11.9.45] 전체 경로 내비게이션 앱 선택 시트 */}
            <Sheet open={showRouteNav} onOpenChange={setShowRouteNav}>
                <SheetContent side="bottom" className="rounded-t-[32px] p-8 bg-[#F7F5EF] border-none shadow-2xl">
                    <SheetHeader className="mb-8">
                        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
                        <SheetTitle className="text-left text-2xl font-black text-[#224732] flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-[#224732]/10 text-[#224732]">
                                <Navigation className="w-6 h-6" />
                            </div>
                            어떤 내비로 안내할까요?
                        </SheetTitle>
                        <SheetDescription className="text-left text-gray-500 font-medium">
                            선택하신 경로와 경유지를 포함하여 안내를 시작합니다.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="grid grid-cols-3 gap-4 pb-6">
                        <Button
                            variant="outline"
                            disabled={isLocating}
                            className="h-28 flex flex-col gap-3 rounded-3xl border-white bg-white shadow-sm hover:shadow-md hover:border-yellow-400 hover:bg-yellow-50/30 transition-all duration-300 disabled:opacity-70"
                            onClick={() => {
                                if (!selectedRouteData) {
                                    toast.error('경로 정보를 찾을 수 없습니다.');
                                    return;
                                }
                                
                                // [v11.9.61] 실시간 위치 정보가 없으면 프로필 정보를 폴백으로 사용
                                const startLoc = userOrigin || origin;
                                if (!startLoc) {
                                    toast.error('출발지 정보를 찾을 수 없습니다. 프로필 설정을 확인해주세요.');
                                    return;
                                }

                                const route = {
                                    origin: { name: '나의 출발지', ...startLoc },
                                    destination: { name: '라온아이 캠핑장', ...location },
                                    waypoints: selectedMidpoint ? [{ name: '선택한 경유지', ...selectedMidpoint }] : []
                                };
                                openNavApp('kakaonavi', route);
                                setShowRouteNav(false);
                            }}
                        >
                            <div className="w-12 h-12 rounded-2xl bg-yellow-400 flex items-center justify-center text-white text-sm font-black shadow-sm">
                                {isLocating ? <RefreshCw className="w-6 h-6 animate-spin" /> : 'K'}
                            </div>
                            <span className="text-[14px] font-black text-gray-900">{isLocating ? '위치 확인중' : '카카오내비'}</span>
                        </Button>

                        <Button
                            variant="outline"
                            disabled={isLocating}
                            className="h-28 flex flex-col gap-3 rounded-3xl border-white bg-white shadow-sm hover:shadow-md hover:border-blue-600 hover:bg-blue-50/30 transition-all duration-300 disabled:opacity-70"
                            onClick={() => {
                                if (!selectedRouteData) {
                                    toast.error('경로 정보를 찾을 수 없습니다.');
                                    return;
                                }
                                const startLoc = userOrigin || origin;
                                if (!startLoc) {
                                    toast.error('출발지 정보를 찾을 수 없습니다.');
                                    return;
                                }
                                const route = {
                                    origin: { name: '나의 출발지', ...startLoc },
                                    destination: { name: '라온아이 캠핑장', ...location },
                                    waypoints: selectedMidpoint ? [{ name: '선택한 경유지', ...selectedMidpoint }] : []
                                };
                                openNavApp('tmap', route);
                                setShowRouteNav(false);
                            }}
                        >
                            <div className="w-12 h-12 rounded-2xl bg-[#FF4500] flex items-center justify-center text-white text-[10px] font-black shadow-sm">
                                {isLocating ? <RefreshCw className="w-6 h-6 animate-spin" /> : 'TMAP'}
                            </div>
                            <span className="text-[14px] font-black text-gray-900">{isLocating ? '위치 확인중' : 'T맵'}</span>
                        </Button>

                        <Button
                            variant="outline"
                            disabled={isLocating}
                            className="h-28 flex flex-col gap-3 rounded-3xl border-white bg-white shadow-sm hover:shadow-md hover:border-emerald-500 hover:bg-emerald-50/30 transition-all duration-300 disabled:opacity-70"
                            onClick={() => {
                                if (!selectedRouteData) {
                                    toast.error('경로 정보를 찾을 수 없습니다.');
                                    return;
                                }
                                const startLoc = userOrigin || origin;
                                if (!startLoc) {
                                    toast.error('출발지 정보를 찾을 수 없습니다.');
                                    return;
                                }
                                const route = {
                                    origin: { name: '나의 출발지', ...startLoc },
                                    destination: { name: '라온아이 캠핑장', ...location },
                                    waypoints: selectedMidpoint ? [{ name: '선택한 경유지', ...selectedMidpoint }] : []
                                };
                                openNavApp('naver', route);
                                setShowRouteNav(false);
                            }}
                        >
                            <div className="w-12 h-12 rounded-2xl bg-[#03C75A] flex items-center justify-center text-white text-xs font-black shadow-sm">
                                {isLocating ? <RefreshCw className="w-6 h-6 animate-spin" /> : 'N'}
                            </div>
                            <span className="text-[14px] font-black text-gray-900">{isLocating ? '위치 확인중' : '네이버 지도'}</span>
                        </Button>
                    </div>
                    
                    <p className="text-center text-[11px] text-gray-400 font-medium">
                        앱이 설치되어 있지 않으면 웹 브라우저 지도로 연결됩니다.
                    </p>
                </SheetContent>
            </Sheet>
        </div>
    );
}
