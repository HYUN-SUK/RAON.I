'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Sparkles,
    Search,
    Calendar,
    MapPin,
    ArrowRight,
    Loader2,
    RefreshCw,
    CheckCircle2,
    Check,
    Users,
    Heart,
    ChevronDown,
    Building2,
    Navigation,
    Shield,
    AlertCircle,
    ArrowRightLeft,
    ShieldCheck,
    Phone,
    Map as MapIcon,
    X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatPlaceDetailText, getPlacePhoneNumber } from '@/utils/placeFormatter';
import { searchAddressAction, CampingProfile, getCampingProfile } from '@/actions/camping-profile';
import { generateInstantPlanAction, saveInstantPlanToScheduleAction } from '@/actions/instant-plan';
import { StandardizedPlanJSON, FactCard } from '@/lib/smartPlan';
import CampingProfileGate from '@/components/shared/CampingProfileGate';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { openNavApp } from '@/lib/nav-utils';
import SmartPlanMapViewModal from '@/components/plan/SmartPlanMapViewModal';

const CATEGORY_ICONS: Record<string, string> = {
    'ROUTE_CAFE': '☕',
    'ROUTE_RESTAURANT': '🍲',
    'ROUTE_SPOT': '📸',
    'HOSPITAL': '🏥',
    'MART': '🛒',
    'GAS_STATION': '⛽',
    'RESTAURANT': '🍽️',
    'SPOT': '🏞️',
    'FESTIVAL': '🎪',
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
    'FESTIVAL': '로컬 축제/이벤트',
};

interface InstantPlanModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialMode?: 'NEARBY' | 'DESTINATION';
    userLat?: number;
    userLng?: number;
    fallbackNotice?: string | null;
    initialDestination?: { name: string; lat: number; lng: number; address?: string } | null;
}

export default function InstantPlanModal({
    isOpen,
    onClose,
    initialMode = 'DESTINATION',
    userLat,
    userLng,
    fallbackNotice,
    initialDestination,
}: InstantPlanModalProps) {
    const router = useRouter();

    // Step state: 'INPUT' | 'GENERATING' | 'RESULT' | 'PROFILE_GATE'
    const [step, setStep] = useState<'INPUT' | 'GENERATING' | 'RESULT' | 'PROFILE_GATE'>('INPUT');

    // Form inputs
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDestination, setSelectedDestination] = useState<{
        name: string;
        lat: number;
        lng: number;
        address?: string;
    } | null>(null);

    // Date defaults: today for NEARBY, upcoming Saturday for DESTINATION
    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
    const defaultSaturday = useMemo(() => {
        const d = new Date();
        const day = d.getDay();
        const diff = (6 - day + 7) % 7 || 7;
        d.setDate(d.getDate() + diff);
        return d.toISOString().split('T')[0];
    }, []);

    const [targetDate, setTargetDate] = useState<string>(defaultSaturday);

    // Search results
    const [searchResults, setSearchResults] = useState<{ label: string; lat: number; lng: number }[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Generated plan
    const [planData, setPlanData] = useState<StandardizedPlanJSON | null>(null);

    // Swap modal state inside result view
    const [swapCategory, setSwapCategory] = useState<string | null>(null);
    const [swapTargetId, setSwapTargetId] = useState<string | null>(null);

    // Nav selection state (카카오맵 / 카카오내비 / T맵)
    const [navTargetCard, setNavTargetCard] = useState<FactCard | null>(null);

    // Map modal state (대체리스트 지도로 보기)
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);
    const [mapCurrentActiveCard, setMapCurrentActiveCard] = useState<any>(null);
    const [mapCandidateCards, setMapCandidateCards] = useState<any[]>([]);
    const savedSwapCategoryRef = React.useRef<string | null>(null);
    const savedSwapTargetIdRef = React.useRef<string | null>(null);

    // Schedule saving state
    const [isSaving, setIsSaving] = useState(false);
    const [existingProfile, setExistingProfile] = useState<CampingProfile | null>(null);
    const [activeFallbackNotice, setActiveFallbackNotice] = useState<string | null>(fallbackNotice || null);
    const nearbyRunningRef = React.useRef(false);

    useEffect(() => {
        setActiveFallbackNotice(fallbackNotice || null);
    }, [fallbackNotice]);

    // Reset or initialize on open (0초 즉시 시트 오픈 및 로딩 진입)
    useEffect(() => {
        if (!isOpen) {
            nearbyRunningRef.current = false;
            return;
        }

        if (initialMode === 'NEARBY') {
            if (nearbyRunningRef.current) return;
            nearbyRunningRef.current = true;

            // 1. 즉시 로딩 상태 및 기본 목적지 명칭 세팅 (0초 반응)
            setStep('GENERATING');
            setPlanData(null);
            setSwapCategory(null);
            setTargetDate(todayStr);
            const initialTargetName = fallbackNotice ? '라온아이 캠핑장 (예산)' : '내 주변 (실시간 GPS)';
            setSelectedDestination({
                name: initialTargetName,
                lat: userLat || 36.6575,
                lng: userLng || 126.6582,
                address: fallbackNotice ? '충남 예산군 덕산면' : '내 현재 위치',
            });
            setSearchQuery(initialTargetName);

            // 2. 비동기 위치 확인 후 즉시 4단계 플랜 생성 기동
            (async () => {
                let targetLat = userLat;
                let targetLng = userLng;
                let notice = fallbackNotice || null;

                // props로 좌표가 아직 없는 경우 브라우저 실시간 GPS 직접 측정 (최대 4초 타임아웃)
                if (!targetLat || !targetLng) {
                    if (typeof window !== 'undefined' && navigator.geolocation) {
                        try {
                            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                                navigator.geolocation.getCurrentPosition(resolve, reject, {
                                    timeout: 4000,
                                    enableHighAccuracy: true,
                                    maximumAge: 60000,
                                });
                            });
                            targetLat = pos.coords.latitude;
                            targetLng = pos.coords.longitude;
                        } catch (geoErr) {
                            console.warn('GPS measurement error in modal, fallback to Raon I:', geoErr);
                            targetLat = 36.6575;
                            targetLng = 126.6582;
                            notice = "위치 동의를 받지 못하여 대표 기준 위치(라온아이 캠핑장)를 기준으로 즉시 여행계획을 작성했습니다.";
                        }
                    } else {
                        targetLat = 36.6575;
                        targetLng = 126.6582;
                        notice = "위치 동의를 받지 못하여 대표 기준 위치(라온아이 캠핑장)를 기준으로 즉시 여행계획을 작성했습니다.";
                    }
                }

                setActiveFallbackNotice(notice);
                const finalTargetName = notice ? '라온아이 캠핑장 (예산)' : '내 주변 (실시간 GPS)';
                const finalAddress = notice ? '충남 예산군 덕산면' : '내 현재 위치';
                const dest = {
                    name: finalTargetName,
                    lat: targetLat!,
                    lng: targetLng!,
                    address: finalAddress,
                };
                setSelectedDestination(dest);
                setSearchQuery(finalTargetName);

                try {
                    const res = await generateInstantPlanAction({
                        targetLat: dest.lat,
                        targetLng: dest.lng,
                        targetName: dest.name,
                        targetDate: todayStr,
                        stayDays: 1,
                    });
                    if (res.success && res.data) {
                        setPlanData(res.data);
                        setStep('RESULT');
                        toast.success('⚡ 즉시 여행계획이 완성되었습니다!');
                    } else {
                        toast.error(res.error || '여행계획 생성에 실패했습니다.');
                        setStep('INPUT');
                    }
                } catch (err) {
                    console.error('Generate nearby plan error:', err);
                    toast.error('여행계획 생성 중 오류가 발생했습니다.');
                    setStep('INPUT');
                }
            })();
        } else {
            if (initialDestination) {
                setSelectedDestination(initialDestination);
                setSearchQuery(initialDestination.name);
            } else {
                setSearchQuery('');
                setSelectedDestination(null);
            }
            setActiveFallbackNotice(fallbackNotice || null);
            setTargetDate(defaultSaturday);
            setStep('INPUT');
            setPlanData(null);
            setSwapCategory(null);
        }
    }, [isOpen, initialMode, todayStr, defaultSaturday]);

    // Handle address / keyword search
    const handleSearch = async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        try {
            const res = await searchAddressAction(query);
            setSearchResults(res);
        } catch (err) {
            console.error('Search failed:', err);
        } finally {
            setIsSearching(false);
        }
    };

    // Trigger Instant Generation
    const handleGeneratePlan = async (dest?: { name: string; lat: number; lng: number; address?: string }) => {
        const target = dest || selectedDestination;
        if (!target) {
            toast.error('목적지를 먼저 선택해주세요.');
            return;
        }

        setStep('GENERATING');
        try {
            const res = await generateInstantPlanAction({
                targetLat: target.lat,
                targetLng: target.lng,
                targetName: target.name,
                targetDate: targetDate,
                stayDays: 1,
            });

            if (res.success && res.data) {
                setPlanData(res.data);
                setStep('RESULT');
                toast.success('⚡ 즉시 여행계획이 완성되었습니다!');
            } else {
                toast.error(res.error || '여행계획 생성에 실패했습니다.');
                setStep('INPUT');
            }
        } catch (err: any) {
            console.error('Generate plan error:', err);
            toast.error('여행계획 생성 중 오류가 발생했습니다.');
            setStep('INPUT');
        }
    };

    // Card swap logic
    const handleSwapPlace = (category: string, newCardId: string) => {
        if (!planData) return;
        const targetId = swapTargetId || savedSwapTargetIdRef.current;
        const alts = planData.alternatives?.[category] || [];
        const newCard = alts.find(c => c.id === newCardId);
        if (!newCard) return;

        const currentActiveInfo = planData.itemListElement.find(item => item.id === targetId);
        if (!currentActiveInfo) return;

        // 맞교환: alternatives에서 newCard를 currentActiveInfo로 교체
        const newAlts = alts.map(c => c.id === newCardId ? { ...currentActiveInfo, selectionTier: 'ALTERNATIVE' as const } : c);

        const updatedItemList = planData.itemListElement.map(item => {
            if (item.id === targetId) {
                return { ...newCard, selectionTier: 'PRIMARY' as const };
            }
            return item;
        });

        setPlanData({
            ...planData,
            itemListElement: updatedItemList,
            alternatives: {
                ...planData.alternatives,
                [category]: newAlts,
            }
        });
        setSwapCategory(null);
        setSwapTargetId(null);
        savedSwapCategoryRef.current = null;
        savedSwapTargetIdRef.current = null;
        toast.success('일정이 교체되었습니다.');
    };

    const handleCardClick = (card: FactCard) => {
        const officialUrl = card.metadata?.url || card.metadata?.homepage || card.metadata?.link;
        if (officialUrl && officialUrl !== '없음') {
            window.open(officialUrl, '_blank');
        } else {
            const address = card.metadata?.address || card.metadata?.addr || '';
            let sigungu = '';
            if (address) {
                const parts = address.trim().split(/\s+/);
                if (parts.length >= 2) {
                    sigungu = parts[1];
                }
            }
            const queryStr = sigungu ? `${sigungu} ${card.name}` : card.name;
            const query = encodeURIComponent(queryStr);
            window.open(`https://search.naver.com/search.naver?query=${query}`, '_blank');
        }
    };

    const handleNavClick = (e: React.MouseEvent, card: FactCard) => {
        e.stopPropagation();
        setNavTargetCard(card);
    };

    const handleNavChoice = (app: 'kakao' | 'tmap' | 'kakaonavi') => {
        if (!navTargetCard) return;
        const { name, lat, lng } = navTargetCard;
        openNavApp(app, {
            origin: { name: '현재 위치', lat: 0, lng: 0 },
            destination: { name, lat, lng }
        });
        setNavTargetCard(null);
    };

    // 대체리스트 지도로 보기 모달 오픈
    const handleOpenAlternativesMap = (currentActive: any, allOptions: any[]) => {
        savedSwapCategoryRef.current = swapCategory;
        savedSwapTargetIdRef.current = swapTargetId;
        setSwapCategory(null);
        setMapCurrentActiveCard(currentActive);
        setMapCandidateCards(allOptions);
        setIsMapModalOpen(true);
    };

    // 지도 창에서 리스트로 복귀
    const handleSwitchToList = () => {
        setIsMapModalOpen(false);
        if (savedSwapCategoryRef.current) {
            setSwapCategory(savedSwapCategoryRef.current);
            if (savedSwapTargetIdRef.current) {
                setSwapTargetId(savedSwapTargetIdRef.current);
            }
        }
    };

    // Proceed to Save Schedule (Check user session & profile)
    const handleStartSaveSchedule = async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            toast.error('내 일정으로 저장하려면 로그인이 필요합니다.');
            router.push('/login');
            return;
        }

        // Check if profile exists
        try {
            const prof = await getCampingProfile();
            setExistingProfile(prof);
        } catch {}

        setStep('PROFILE_GATE');
    };

    // Final Save Execution after profile gate complete
    const handleProfileCompleteAndSave = async (profile: CampingProfile) => {
        if (!planData || !selectedDestination) return;

        setIsSaving(true);
        try {
            const checkOutDate = new Date(targetDate);
            checkOutDate.setDate(checkOutDate.getDate() + 1);
            const checkOutStr = checkOutDate.toISOString().split('T')[0];

            const res = await saveInstantPlanToScheduleAction({
                campgroundName: selectedDestination.name,
                campgroundAddress: selectedDestination.address || '',
                campgroundLat: selectedDestination.lat,
                campgroundLng: selectedDestination.lng,
                checkIn: targetDate,
                checkOut: checkOutStr,
                planData: planData,
                profile: profile,
            });

            if (res.success && res.scheduleId) {
                toast.success('🎉 내 일정에 저장되었습니다! 다음날 오전 9시 이후 정밀 플랜으로 업그레이드할 수 있습니다.');
                onClose();
                router.push(`/myspace/schedule/${res.scheduleId}`);
            } else {
                toast.error(res.error || '일정 저장에 실패했습니다.');
            }
        } catch (err: any) {
            console.error('Save schedule error:', err);
            toast.error('일정 저장 중 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="bottom" className="max-w-[430px] mx-auto left-0 right-0 rounded-t-3xl max-h-[92vh] h-[92vh] flex flex-col p-0 bg-stone-50 dark:bg-zinc-950 overflow-hidden">
                {/* 상단 헤더 */}
                <SheetHeader className="p-4 pb-3 border-b border-stone-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-[#224732]/10 text-[#224732] dark:text-emerald-400 rounded-xl">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div>
                                <SheetTitle className="text-base font-black text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                                    {initialMode === 'NEARBY' ? '내 주변 즉시 여행계획' : '목적지 즉시 여행계획'}
                                    <span className="text-[10px] bg-[#224732] text-white font-bold px-1.5 py-0.5 rounded-full">
                                        {initialMode === 'NEARBY' ? (activeFallbackNotice ? '대표 기준 위치' : '실시간 GPS') : '즉시 생성'}
                                    </span>
                                </SheetTitle>
                                <p className="text-[11px] text-stone-500 font-medium mt-0.5">
                                    검증된 내부 데이터베이스 기반으로 4단계 일정을 자동 완성합니다.
                                </p>
                            </div>
                        </div>

                        {step === 'RESULT' && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setStep('INPUT')}
                                className="h-8 px-2 text-xs text-stone-500 hover:text-stone-800"
                            >
                                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                                재검색
                            </Button>
                        )}
                    </div>
                </SheetHeader>

                {/* 본문 영역 */}
                <div className="flex-1 overflow-y-auto p-4">
                    {/* 1. 입력 단계 (INPUT) */}
                    {step === 'INPUT' && (
                        <div className="space-y-5 py-2">
                            {/* 목적지 검색창 */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                                    어디로 떠나시나요? (캠핑장 또는 여행지)
                                </label>
                                <div className="relative">
                                    <Input
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            handleSearch(e.target.value);
                                        }}
                                        placeholder="캠핑장명, 지역, 관광지 검색 (예: 가평, 태안, 라온아이)"
                                        className="h-12 pl-10 pr-4 rounded-xl text-sm border-stone-300 focus-visible:ring-amber-500"
                                    />
                                    <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-4" />
                                </div>

                                {/* 검색 자동완성 결과 리스트 */}
                                {searchResults.length > 0 && (
                                    <div className="bg-white dark:bg-zinc-900 border border-stone-200 rounded-xl shadow-lg overflow-hidden divide-y divide-stone-100">
                                        {searchResults.map((item, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    setSelectedDestination({
                                                        name: item.label,
                                                        lat: item.lat,
                                                        lng: item.lng,
                                                        address: item.label,
                                                    });
                                                    setSearchQuery(item.label);
                                                    setSearchResults([]);
                                                }}
                                                className="w-full px-4 py-3 text-left hover:bg-amber-50 dark:hover:bg-zinc-800 flex items-center justify-between text-xs text-stone-800 dark:text-stone-200"
                                            >
                                                <span className="font-semibold">{item.label}</span>
                                                <span className="text-[10px] text-amber-600 font-bold">선택</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 여행 날짜 선택 */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                                    출발 예정일
                                </label>
                                <Input
                                    type="date"
                                    value={targetDate}
                                    onChange={(e) => setTargetDate(e.target.value)}
                                    className="h-11 rounded-xl text-sm border-stone-300"
                                />
                            </div>

                            {/* 생성 시작 버튼 */}
                            <div className="pt-4">
                                <Button
                                    onClick={() => handleGeneratePlan()}
                                    disabled={!selectedDestination && !searchQuery}
                                    className="w-full h-13 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                                >
                                    <Sparkles className="w-4 h-4 text-amber-200" />
                                    <span>⚡ 즉시 여행계획 만들기</span>
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* 2. 생성 중 로딩 애니메이션 (GENERATING) */}
                    {step === 'GENERATING' && (
                        <div className="py-24 flex flex-col items-center justify-center text-center space-y-4">
                            <div className="relative">
                                <div className="w-16 h-16 rounded-full border-4 border-amber-200 border-t-amber-600 animate-spin" />
                                <Sparkles className="w-6 h-6 text-amber-500 absolute inset-0 m-auto animate-pulse" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-black text-stone-800 dark:text-stone-100">
                                    {selectedDestination?.name ? `${selectedDestination.name} ` : ''}4단계 일정 최적화 중...
                                </p>
                                <p className="text-xs text-stone-500">
                                    검증된 내부 데이터베이스를 바탕으로 인증 맛집, 분위기 카페, 힐링 명소를 엄선합니다.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* 3. 4단계 여행계획 결과 표시 (RESULT) */}
                    {step === 'RESULT' && planData && (
                        <div className="space-y-6 pb-4">
                            {/* 위치 미동의 안내 배너 */}
                            {activeFallbackNotice && (
                                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                    <p className="font-medium leading-relaxed">{activeFallbackNotice}</p>
                                </div>
                            )}

                            {/* 헤더 요약 뱃지 */}
                            <div className="p-3.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-300/60 rounded-2xl flex items-center justify-between text-xs text-amber-900">
                                <div className="flex items-center gap-2">
                                    <span className="text-base">📍</span>
                                    <span className="font-bold">{selectedDestination?.name}</span>
                                    <span className="text-[11px] text-stone-500 font-medium">({targetDate})</span>
                                </div>
                                <span className="text-[10px] bg-amber-200/80 text-amber-900 font-black px-2 py-0.5 rounded-full">
                                    즉시 여행계획 4단계
                                </span>
                            </div>

                            {/* 감성 타임라인 리스트 (Stage 1 ~ 4) */}
                            <div className="grid grid-cols-1 gap-8 relative before:absolute before:inset-0 before:left-[10px] md:before:left-[10px] before:w-0.5 before:bg-[#224732]/10 before:z-0 w-full min-w-0">
                                {/* Stage 1: 현지 식도락 (대표 맛집) */}
                                <div className="space-y-3 relative z-10 w-full">
                                    <div className="flex flex-col gap-1 mb-2 ml-4 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full border-2 border-[#224732] bg-white ring-4 ring-white z-10 -ml-[6px]" />
                                            <span className="text-xs font-bold text-[#224732]">
                                                Stage 1. 현지 식도락 (대표 맛집)
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-gray-500 italic ml-5 leading-relaxed pr-3 whitespace-normal break-words mr-4 min-w-0">
                                            "{planData.stageIntros?.['1'] || '목적지로 향하며 즐기는 현지 식도락 대표 맛집입니다.'}"
                                        </p>
                                    </div>
                                    <div className="px-2 space-y-3 w-full min-w-0">
                                        {planData.itemListElement
                                            .filter(c => c.category === 'RESTAURANT')
                                            .map(card => renderInstantCard(card, 'RESTAURANT'))}
                                    </div>
                                </div>

                                {/* Stage 2: 여행의 쉼표 (로컬 카페) */}
                                <div className="space-y-3 relative z-10 w-full min-w-0">
                                    <div className="flex flex-col gap-1 mb-2 ml-4 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-[#224732] ring-4 ring-white z-10 -ml-[6px]" />
                                            <span className="text-xs font-bold text-[#224732]">
                                                Stage 2. 여행의 쉼표 (로컬 카페)
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-gray-500 italic ml-5 leading-relaxed pr-3 whitespace-normal break-words mr-4 min-w-0">
                                            "{planData.stageIntros?.['2'] || '잠시 쉬어가며 여유를 즐길 수 있는 분위기 좋은 카페입니다.'}"
                                        </p>
                                    </div>
                                    <div className="px-2 space-y-3 w-full min-w-0">
                                        {planData.itemListElement
                                            .filter(c => c.category === 'ROUTE_CAFE')
                                            .map(card => renderInstantCard(card, 'ROUTE_CAFE'))}
                                    </div>
                                </div>

                                {/* Stage 3: 목적지 힐링 명소 & 축제 */}
                                <div className="space-y-3 relative z-10 w-full min-w-0">
                                    <div className="flex flex-col gap-1 mb-2 ml-4 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-[#224732] ring-4 ring-white z-10 -ml-[6px]" />
                                            <span className="text-xs font-bold text-[#224732]">
                                                Stage 3. 목적지 힐링 명소 & 축제
                                            </span>
                                            {planData.itemListElement.some(c => c.category === 'FESTIVAL') && (
                                                <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-1.5 py-0.5 rounded-full">
                                                    🎉 축제 개최 중!
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-gray-500 italic ml-5 leading-relaxed pr-3 whitespace-normal break-words mr-4 min-w-0">
                                            "{planData.stageIntros?.['3'] || '목적지 주변의 검증된 로컬 명소와 축제를 엄선했습니다.'}"
                                        </p>
                                    </div>
                                    <div className="px-2 space-y-3 w-full min-w-0">
                                        {planData.itemListElement
                                            .filter(c => c.category === 'SPOT')
                                            .map(card => renderInstantCard(card, 'SPOT'))}
                                        {planData.itemListElement
                                            .filter(c => c.category === 'FESTIVAL')
                                            .map(card => renderInstantCard(card, 'FESTIVAL'))}
                                    </div>
                                </div>

                                {/* Stage 4: 편의시설 안내 (안심 인프라) */}
                                <div className="space-y-3 relative z-10 w-full min-w-0">
                                    <div className="flex flex-col gap-1 mb-2 ml-4 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-blue-600 ring-4 ring-white z-10 -ml-[6px]" />
                                            <span className="text-xs font-bold text-blue-900">Stage 4. 편의시설 안내</span>
                                            <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">안전·인프라</span>
                                        </div>
                                        <p className="text-[11px] text-gray-500 italic ml-5 leading-relaxed pr-3 whitespace-normal break-words mr-4 min-w-0">
                                            "{planData.stageIntros?.['4'] || '쾌적하고 안전한 여행을 위한 장보기 마트, 응급 병원, 주유소 정보입니다.'}"
                                        </p>
                                    </div>
                                    {/* 차별화된 안심 인프라 2중 박스 컨테이너 */}
                                    <div className="mx-2 p-3.5 bg-gradient-to-b from-blue-50/70 to-slate-50/80 border border-blue-200/90 rounded-2xl shadow-sm space-y-3">
                                        <div className="flex items-center justify-between px-1 pb-2 border-b border-blue-200/60 text-blue-900 text-[11px] font-bold">
                                            <span className="flex items-center gap-1.5">
                                                🛡️ 안심 여행 필수 인프라
                                            </span>
                                            <span className="text-[10px] text-blue-600/80 font-medium">마트 · 병원 · 주유소</span>
                                        </div>
                                        {/* 1. 마트 */}
                                        {planData.itemListElement
                                            .filter(c => c.category === 'MART')
                                            .map(card => renderInstantCard(card, 'MART'))}
                                        {/* 2. 병원 */}
                                        {planData.itemListElement
                                            .filter(c => c.category === 'HOSPITAL')
                                            .map(card => renderInstantCard(card, 'HOSPITAL'))}
                                        {/* 3. 주유소 안내 뱃지 */}
                                        <div className="p-3 bg-white/70 border border-blue-100 rounded-xl flex items-center justify-between text-xs text-blue-800">
                                            <span className="flex items-center gap-1.5 font-medium">⛽ 최저가 주유소</span>
                                            <span className="text-[10px] text-blue-600 font-medium bg-blue-100/60 px-2 py-0.5 rounded-full">정밀 승격 시 실시간 최저가 자동 배정</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4. 프로필 게이트 단계 (PROFILE_GATE) */}
                    {step === 'PROFILE_GATE' && (
                        <div className="space-y-4 py-2">
                            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
                                <p className="font-bold flex items-center gap-1">
                                    <Users className="w-4 h-4 text-amber-700" />
                                    출발지와 인원 구성을 확인해주세요
                                </p>
                                <p className="text-[11px] text-amber-800/80">
                                    출발 7일 전/당일 09:00에 집에서 출발하는 최적 정밀 스마트플랜으로 업그레이드할 때 활용됩니다.
                                </p>
                            </div>

                            <CampingProfileGate
                                onComplete={handleProfileCompleteAndSave}
                                requireOrigin={true}
                                title="일정 등록 기본 정보"
                                compact={false}
                            />

                            {isSaving && (
                                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
                                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-xl flex flex-col items-center space-y-3">
                                        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                                        <p className="text-xs font-bold text-stone-700">일정을 저장하고 있습니다...</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 하단 고정 CTA */}
                {step === 'RESULT' && (
                    <div className="p-4 bg-white/95 dark:bg-zinc-900/95 border-t border-stone-200/80 dark:border-zinc-800 shadow-xl z-20 shrink-0 space-y-1.5">
                        <Button
                            onClick={handleStartSaveSchedule}
                            className="w-full h-12 bg-gradient-to-r from-[#224732] to-[#2d5d42] hover:from-[#1b3928] hover:to-[#224732] text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                            <Calendar className="w-4 h-4 text-emerald-300" />
                            <span>📅 이 계획으로 내 일정에 등록하기</span>
                        </Button>
                        <p className="text-[11px] text-center text-stone-500 dark:text-stone-400 font-medium">
                            💡 공식 일정으로 등록 시 경유지, 날씨 등 더 풍부한 계획을 받아보실 수 있습니다.
                        </p>
                    </div>
                )}

                {/* 1. 대안 장소 교체 바텀 시트 (SmartPlanProposal 1:1 일치) */}
                {swapCategory && (
                    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
                        {/* 외부 터치 시 닫기 */}
                        <div 
                            className="absolute inset-0"
                            onClick={() => setSwapCategory(null)}
                        />
                        <div className="relative w-full max-h-[85vh] overflow-y-auto bg-[#F7F5EF] rounded-t-3xl px-4 pb-8 z-10 shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300">
                            {/* 헤더 */}
                            <div className="flex items-center justify-between pb-4 pt-4 border-b border-gray-200">
                                <div>
                                    <h3 className="text-left text-lg font-bold text-[#224732]">
                                        {CATEGORY_NAMES[swapCategory] || '일정'} 교체
                                    </h3>
                                    <p className="text-left text-xs text-gray-500 mt-0.5">
                                        캠퍼님의 취향에 맞는 다른 선택지를 골라보세요.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSwapCategory(null)}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full active:scale-95 transition-all"
                                    aria-label="닫기"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="py-4 space-y-4">
                                {(() => {
                                    if (!swapCategory || !planData) return null;
                                    const currentActive = planData.itemListElement?.find(c => c.id === (swapTargetId || savedSwapTargetIdRef.current));
                                    const rawAlternatives = planData.alternatives?.[swapCategory] || [];
                                    const availableAlternatives = rawAlternatives.filter(c => c.id !== currentActive?.id);
                                    const allOptions = currentActive ? [currentActive, ...availableAlternatives] : availableAlternatives;

                                    if (allOptions.length === 0) {
                                        return (
                                            <div className="py-12 text-center text-xs text-gray-500 font-medium">
                                                주변에 등록된 다른 추천 후보가 없습니다.
                                            </div>
                                        );
                                    }

                                    return (
                                        <>
                                            {/* 상단 컨트롤 바: 추천 개수 및 [지도로 보기] 버튼 */}
                                            <div className="flex items-center justify-between pb-3 mb-1 border-b border-gray-200/80">
                                                <span className="text-xs font-bold text-gray-500">
                                                    총 {allOptions.length}개 추천 후보
                                                </span>
                                                <Button
                                                    size="sm"
                                                    onClick={() => {
                                                        handleOpenAlternativesMap(currentActive, allOptions);
                                                    }}
                                                    className="bg-[#224732] hover:bg-[#1a3827] text-white font-bold text-xs h-8 px-3 rounded-xl shadow-sm flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                                                >
                                                    <MapIcon className="w-3.5 h-3.5 text-emerald-300" />
                                                    <span>지도로 보기</span>
                                                </Button>
                                            </div>

                                            {/* 추천 후보 리스트 (3개 1묶음 가로 스와이프 캐러셀) */}
                                            <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4 gap-4 pb-4">
                                                {(() => {
                                                    const chunks = [];
                                                    for (let i = 0; i < allOptions.length; i += 3) {
                                                        chunks.push(allOptions.slice(i, i + 3));
                                                    }

                                                    return chunks.map((chunk, chunkIdx) => (
                                                        <div key={chunkIdx} className="snap-center shrink-0 w-[88vw] max-w-[420px] space-y-3">
                                                            {chunk.map((opt, idx) => {
                                                                const globalIdx = chunkIdx * 3 + idx;
                                                                const isCurrentActive = opt.id === currentActive?.id;
                                                                return (
                                                                    <Card
                                                                        key={opt.id}
                                                                        className={`transition-all border shadow-none cursor-pointer ${isCurrentActive ? 'border-[#224732] ring-1 ring-[#224732] bg-[#224732]/5' : 'border-gray-100 bg-white'}`}
                                                                        onClick={() => handleSwapPlace(swapCategory!, opt.id)}
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
                                                                                
                                                                                <div className="flex flex-wrap items-center gap-1">
                                                                                    {opt.evidence?.stars && (
                                                                                        <span className="text-[9px] bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded-md font-bold border border-yellow-100/30">⭐ {opt.evidence.stars.toFixed(1)}</span>
                                                                                    )}
                                                                                    {(opt.evidence?.displayBadges || []).map((badge: any, i: number) => (
                                                                                        <span key={i} className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-100 flex items-center justify-center leading-none shadow-sm" title={badge.label}>
                                                                                            {badge.emoji}
                                                                                        </span>
                                                                                    ))}
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
                                                                                    <span className="text-[9px] text-gray-400 ml-auto font-medium">Score {Math.round(opt.trustScore)}</span>
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
                        </div>
                    </div>
                )}

                {/* 2. 내비게이션 앱 선택 시트 (SmartPlanProposal 1:1 일치) */}
                {navTargetCard && (
                    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
                        {/* 외부 터치 시 닫기 */}
                        <div 
                            className="absolute inset-0"
                            onClick={() => setNavTargetCard(null)}
                        />
                        <div className="relative w-full rounded-t-3xl p-6 bg-white dark:bg-zinc-900 z-10 shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-left flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100">
                                        <Navigation className="w-5 h-5 text-blue-600" />
                                        길찾기 서비스 선택
                                    </h3>
                                    <p className="text-left text-xs text-gray-500 mt-1">
                                        '{navTargetCard.name}'(으)로 안내할 앱을 선택해주세요.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setNavTargetCard(null)}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full active:scale-95 transition-all"
                                    aria-label="닫기"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="grid grid-cols-3 gap-3 pb-4">
                                <Button
                                    variant="outline"
                                    className="h-24 flex flex-col gap-2 rounded-2xl border-gray-100 hover:border-yellow-400 hover:bg-yellow-50/30 active:scale-95 transition-transform cursor-pointer"
                                    onClick={() => handleNavChoice('kakao')}
                                >
                                    <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-white text-xs font-bold">K</div>
                                    <span className="text-[13px] font-bold text-gray-900 dark:text-gray-100">카카오맵</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-24 flex flex-col gap-2 rounded-2xl border-gray-100 hover:border-yellow-600 hover:bg-yellow-50/50 active:scale-95 transition-transform cursor-pointer"
                                    onClick={() => handleNavChoice('kakaonavi')}
                                >
                                    <div className="w-10 h-10 rounded-full bg-[#FFCD00] flex items-center justify-center text-[#3C1E1E] text-xs font-black italic">NAV</div>
                                    <span className="text-[13px] font-bold text-gray-900 dark:text-gray-100">카카오내비</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-24 flex flex-col gap-2 rounded-2xl border-gray-100 hover:border-blue-600 hover:bg-blue-50/30 active:scale-95 transition-transform cursor-pointer"
                                    onClick={() => handleNavChoice('tmap')}
                                >
                                    <div className="w-10 h-10 rounded-full bg-[#FF4500] flex items-center justify-center text-white text-[10px] font-black">TMAP</div>
                                    <span className="text-[13px] font-bold text-gray-900 dark:text-gray-100">T맵</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. 대화형 지도 모달 (대체리스트 지도로 보기) */}
                <SmartPlanMapViewModal
                    isOpen={isMapModalOpen}
                    onClose={() => setIsMapModalOpen(false)}
                    mode="alternatives"
                    destination={selectedDestination ? { lat: selectedDestination.lat, lng: selectedDestination.lng } : undefined}
                    destinationName={selectedDestination?.name || '목적지'}
                    currentActiveCard={mapCurrentActiveCard}
                    candidateCards={mapCandidateCards}
                    onSelectCandidate={(newPlaceId) => {
                        const cat = swapCategory || savedSwapCategoryRef.current;
                        if (cat) {
                            handleSwapPlace(cat, newPlaceId);
                        }
                        setIsMapModalOpen(false);
                    }}
                    onSwitchToList={handleSwitchToList}
                    renderCustomCard={(card, onCloseCard) => {
                        const isCurrent = card.id === mapCurrentActiveCard?.id;
                        return renderInstantCard(card, card.category, true, {
                            onCloseModalCard: onCloseCard,
                            isAlternativeMapMode: true,
                            isCurrentActive: isCurrent,
                            onSelectCandidate: (newPlaceId) => {
                                const cat = swapCategory || savedSwapCategoryRef.current;
                                if (cat) {
                                    handleSwapPlace(cat, newPlaceId);
                                }
                                setIsMapModalOpen(false);
                            }
                        });
                    }}
                />
            </SheetContent>
        </Sheet>
    );

    // 내부 카드 렌더러 (SmartPlanProposal 스타일 일치)
    function renderInstantCard(
        card: FactCard,
        cat: string,
        allowSwap = true,
        options?: {
            onCloseModalCard?: () => void;
            isAlternativeMapMode?: boolean;
            isCurrentActive?: boolean;
            onSelectCandidate?: (newPlaceId: string) => void;
        }
    ) {
        const addressStr = card.metadata?.address || card.metadata?.addr;
        const isFestival = card.category === 'FESTIVAL';

        return (
            <Card
                key={card.id}
                className={`relative z-10 overflow-hidden transition-all duration-300 cursor-pointer hover:border-[#224732]/30 hover:shadow-sm border-gray-100/80 bg-white dark:bg-zinc-900 w-full`}
                onClick={() => handleCardClick(card)}
            >
                <CardContent className="p-3">
                    <div className="flex gap-2 items-start w-full min-w-0">
                        {/* Left Compact Control Area (위아래 확대된 넉넉한 터치 영역) */}
                        <div className="flex flex-col items-center gap-1.5 shrink-0 w-10 min-w-[40px] pt-0.5">
                            {/* Icon */}
                            <div className="w-10 h-10 rounded-xl bg-[#F7F5EF] text-[#224732] flex items-center justify-center shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.03)] text-lg border border-[#224732]/5 shrink-0">
                                {CATEGORY_ICONS[card.category] || '📍'}
                            </div>
                            {/* Swap Button (h-14 w-9: 세로 알약형) */}
                            {allowSwap && !options?.isAlternativeMapMode && (
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsMapModalOpen(false);
                                        setSwapCategory(cat);
                                        setSwapTargetId(card.id);
                                    }}
                                    className="h-14 w-9 rounded-2xl bg-gray-50 text-gray-600 hover:text-[#224732] hover:bg-[#224732]/10 border border-gray-200/80 active:scale-95 transition-all flex items-center justify-center shadow-xs cursor-pointer"
                                    title="다른 장소로 교체"
                                >
                                    <ArrowRightLeft className="w-4 h-4" />
                                </Button>
                            )}
                            {/* Nav Map Button (h-14 w-9: 세로 알약형) */}
                            <Button
                                size="icon"
                                onClick={(e) => handleNavClick(e, card)}
                                className="h-14 w-9 rounded-2xl bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 border border-blue-200/80 active:scale-95 transition-all flex items-center justify-center shadow-xs cursor-pointer"
                                title="길찾기 내비 연결"
                            >
                                <MapPin className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Right Info Area */}
                        <div className="flex-1 min-w-0 pr-1">
                            <div className="flex items-center justify-between gap-1.5 mb-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-bold text-[#224732] px-1.5 py-0.5 bg-[#224732]/5 rounded-sm">
                                        {card.roleName || CATEGORY_NAMES[card.category] || '추천 장소'}
                                    </span>
                                    {card.verificationStatus === 'VERIFIED' && (
                                        <span className="flex items-center text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-sm">
                                            <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />
                                            검증됨
                                        </span>
                                    )}
                                    {isFestival && (
                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                                            🎉 로컬 축제 개최 중
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    {card.trustScore !== undefined && (
                                        <span className="text-[10px] font-black text-emerald-800 bg-emerald-100/70 px-1.5 py-0.5 rounded-md">
                                            {card.trustScore.toFixed(0)}점
                                        </span>
                                    )}
                                    {options?.onCloseModalCard && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                options.onCloseModalCard?.();
                                            }}
                                            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full shrink-0 flex items-center justify-center"
                                            title="카드 닫고 지도 크게 보기"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <h4 className="font-bold text-gray-900 dark:text-gray-100 text-[15px] truncate">{card.name}</h4>

                            {addressStr && (
                                <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1 truncate">
                                    <MapPin className="w-2.5 h-2.5 shrink-0" />
                                    {addressStr}
                                </p>
                            )}

                            {formatPlaceDetailText(card) && (
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed whitespace-normal keep-all break-words max-w-full font-medium">
                                    {formatPlaceDetailText(card)}
                                </p>
                            )}

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

                            {card.reasoning && (
                                <p className="text-[12px] text-gray-600 mt-0.5 leading-snug italic whitespace-normal keep-all break-words max-w-full min-w-0 pr-2">
                                    "{card.reasoning}"
                                </p>
                            )}

                            {/* Fact Chips */}
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
                                {isFestival && (
                                    <>
                                        <span className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded-md font-bold border border-rose-200">
                                            🎪 개최 중인 지역 축제
                                        </span>
                                        {(card.metadata?.event_start_date || card.metadata?.event_end_date) && (
                                            <span className="text-[10px] bg-rose-50/80 text-rose-600 px-1.5 py-0.5 rounded-md font-medium border border-rose-100">
                                                🗓️ {(() => {
                                                    const s = String(card.metadata.event_start_date || '').replace(/\D/g, '');
                                                    const e = String(card.metadata.event_end_date || '').replace(/\D/g, '');
                                                    const fmt = (x: string) => x.length === 8 ? `${x.slice(4, 6)}.${x.slice(6, 8)}` : x;
                                                    return `${fmt(s)} ~ ${fmt(e)}`;
                                                })()}
                                            </span>
                                        )}
                                    </>
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
                                {card.distanceKm !== undefined && card.distanceKm > 0 && (
                                    <span className="text-[10px] text-gray-400 font-medium">
                                        📍 {card.distanceKm.toFixed(1)}km 거리
                                    </span>
                                )}
                            </div>

                            {/* 병원 응급실 직통전화 버튼 */}
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

                            {/* 대체 지도 전용 [이 장소로 선택] 버튼 */}
                            {options?.isAlternativeMapMode && (
                                <div 
                                    className="mt-2.5 pt-2 border-t border-gray-100/80 flex items-center justify-end"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {options?.isCurrentActive ? (
                                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200/80 flex items-center gap-1">
                                            <Check className="w-3 h-3 text-emerald-600" />
                                            현재 선택된 장소
                                        </span>
                                    ) : (
                                        <Button
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (options?.onSelectCandidate) {
                                                    options.onSelectCandidate(card.id);
                                                }
                                            }}
                                            className="h-8 px-3.5 bg-[#224732] hover:bg-[#1a3827] text-white font-bold text-xs rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-1.5"
                                        >
                                            <Check className="w-3.5 h-3.5" />
                                            이 장소로 선택
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }
}
