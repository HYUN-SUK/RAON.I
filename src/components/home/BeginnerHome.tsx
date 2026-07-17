import React, { useState, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Phone, Map, Mountain, Tag, Tent, Clock, Wifi, ShoppingBag, Siren, ChefHat, ChevronRight, ChevronDown, Calendar } from 'lucide-react';
import TopBar from '@/components/TopBar';
import NotificationBadge from '@/components/common/NotificationBadge';
import SlimNotice from '@/components/home/SlimNotice';
import { PriceGuideSheet } from '@/components/home/PriceGuideSheet';
import MissionHomeWidget from '@/components/home/MissionHomeWidget';
import HomeDetailSheet, { HomeDetailData } from '@/components/home/HomeDetailSheet';
import WeatherDetailSheet from '@/components/home/WeatherDetailSheet';
import NearbyDetailSheet from '@/components/home/NearbyDetailSheet';
import FacilityDetailSheet from '@/components/home/FacilityDetailSheet';
import ScheduleHomeWidget from '@/components/schedule/ScheduleHomeWidget';
import RecipeDetailSheet, { RecipeData } from '@/components/common/RecipeDetailSheet';
import { motion, AnimatePresence } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

import { OPEN_DAY_CONFIG } from '@/constants/reservation';
import { DEFAULT_CAMPING_LOCATION } from '@/constants/location';
import { format } from 'date-fns';

import { toast } from "sonner";
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { useLBS } from '@/hooks/useLBS';
import { usePersonalizedRecommendation } from '@/hooks/usePersonalizedRecommendation';
import { useReservationStore } from '@/store/useReservationStore';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { usePushNotification } from '@/hooks/usePushNotification';
import { Database } from '@/types/supabase';
import { dispatchPersonaAction } from '@/lib/persona';
import { createClient } from '@/lib/supabase-client';
import { useFabSparkle } from '@/hooks/useFabSparkle';
import ReminderBanner from '@/components/myspace/ReminderBanner';
import QuickRecordForm from '@/components/myspace/QuickRecordForm';
import MyMapModal from '@/components/myspace/MyMapModal';
import { useMySpaceStore } from '@/store/useMySpaceStore';

// Type Definitions from DB
type NearbyEvent = Database['public']['Tables']['nearby_events']['Row'];
type RecommendationPoolItem = Database['public']['Tables']['recommendation_pool']['Row'];

// Simplified types for component usage
interface BeginnerChip {
    type: string;
    icon: React.ReactNode;
    label: string;
    sub: string;
    title: string;
    description: string;
    actionLabel?: string;
    actionLink?: string;
    isPriceGuide?: boolean;
}

interface Facility {
    title?: string;
    description?: string;
    category?: string;
    name: string;
    phone?: string;
    lat?: number;
    lng?: number;
}

// Flexible recommendation item for UI
interface RecommendationItem {
    type?: string;
    title: string;
    description?: string | null;
    icon?: string;
    actionLabel?: string;
    actionLink?: string;
    bgColorClass?: string;
    category?: string;
    ingredients?: unknown;
    materials?: unknown;
    process_steps?: unknown;
    steps?: unknown;
    tips?: string | null;
    time_required?: number | null;
    difficulty?: number | null;
    image_url?: string | null;
    servings?: string | null;
    calories?: number | null;
    age_group?: string | null;
    location_type?: string | null;
    events?: NearbyEvent[];
}

export default function BeginnerHome() {
    const router = useRouter();
    const { config } = useSiteConfig(); // Dynamic Config
    const lbs = useLBS(); // Real-time Location

    const [isMounted, setIsMounted] = useState(false);

    // Contextual Data
    const { reservations, fetchMyReservations, openDayRule, fetchOpenDayRule } = useReservationStore();

    // Accordion States
    const [isIntroExpanded, setIsIntroExpanded] = useState(false);
    const [isScheduleExpanded, setIsScheduleExpanded] = useState(false);
    const [sosoCareSheetOpen, setSosoCareSheetOpen] = useState(false);

    const [isRecordOpen, setIsRecordOpen] = useState(false);
    const { shouldSparkle, unwrittenScheduleIds, unwrittenScheduleDetail, refresh } = useFabSparkle();
    const { isMapOpen, setIsMapOpen } = useMySpaceStore();

    // 다가오는 예약 판단 (체크아웃이 오늘 이후이면서 승인/대기 중인 예약)
    const hasUpcoming = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return reservations.some(r => {
            const checkOut = new Date(r.checkOutDate);
            checkOut.setHours(0, 0, 0, 0);
            return checkOut > today && (r.status === 'PENDING' || r.status === 'CONFIRMED');
        });
    }, [reservations]);

    const { data: recData, loading: recLoading, weather, shuffle } = usePersonalizedRecommendation(false);
    const { requestPermission } = usePushNotification();

    React.useEffect(() => {
        setIsMounted(true);
        fetchOpenDayRule();
        fetchMyReservations();
        requestPermission();
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Bottom Sheet State
    const [detailSheetOpen, setDetailSheetOpen] = useState(false);
    const [weatherSheetOpen, setWeatherSheetOpen] = useState(false);
    const [detailData, setDetailData] = useState<HomeDetailData | null>(null);

    // Recipe Sheet State
    const [recipeSheetOpen, setRecipeSheetOpen] = useState(false);
    const [recipeData, setRecipeData] = useState<RecipeData | null>(null);

    // Nearby LBS Sheet State (Real-time Events)
    const [nearbySheetOpen, setNearbySheetOpen] = useState(false);
    const [nearbyEvents, setNearbyEvents] = useState<NearbyEvent[]>([]);

    // Search Location State (Undefined = default/LBS fallback, Object = specific location)
    const [searchLocation, setSearchLocation] = useState<{ latitude: number, longitude: number } | undefined>(undefined);
    // Custom Description for Nearby Sheet
    const [nearbyDescription, setNearbyDescription] = useState<string | undefined>(undefined);

    // Facility Detail Sheet State
    const [facilitySheetOpen, setFacilitySheetOpen] = useState(false);

    // Dynamic Chip Data
    const chips = useMemo(() => {
        if (!config) return [];

        return [
            {
                type: 'wayfinding',
                icon: <Navigation className="w-5 h-5 text-[#3C6E47] group-hover:text-[#1C4526] transition-colors mb-2" />,
                label: "길찾기",
                sub: "카카오/티맵",
                title: "오시는 길",
                description: `주소: ${config.address_main || ''}\n(상세: ${config.address_detail || '없음'})\n\n예산군의 맑은 공기와 함께하는 여정이 되시길 바랍니다.`,
                actionLabel: "네비게이션 앱 선택",
                actionLink: "sheet:navigation"
            },
            {
                type: 'contact',
                icon: <Phone className="w-5 h-5 text-[#3C6E47] group-hover:text-[#1C4526] transition-colors mb-2" />,
                label: "문의",
                sub: "연락처",
                title: "문의 하기",
                description: `예약 및 이용 관련 문의는 언제든 편하게 연락주세요.\n\n📞 ${config.phone_number || ''}`,
                actionLabel: "전화 연결",
                actionLink: "sheet:contact"
            },
            {
                type: 'rules',
                icon: <Clock className="w-5 h-5 text-[#3C6E47] group-hover:text-[#1C4526] transition-colors mb-2" />,
                label: "이용수칙, 환불규정",
                sub: "규정 안내",
                title: "이용수칙 및 환불규정",
                description: `[이용수칙]\n${config.rules_guide_text || "모두가 행복한 캠핑을 위해 이용 수칙을 준수해주세요.\n\n매너타임: 22:00 ~ 08:00"}\n\n────────────────────\n\n[환불규정]\n${config.refund_rules_text || "• 7일 전: 100% 환불\n• 5~6일 전: 90% 환불\n• 3~4일 전: 50% 환불\n• 1~2일 전: 20% 환불\n• 당일: 환불 불가"}`,
                actionLabel: "확인",
                actionLink: "#"
            },
            {
                type: 'map',
                icon: <Map className="w-5 h-5 text-[#3C6E47] group-hover:text-[#1C4526] transition-colors mb-2" />,
                label: "시설현황",
                sub: "배치도/사진",
                title: "시설 현황",
                description: "캠핑장 배치도와 편의시설(욕실, 개수대, 사이트) 사진을 확인하실 수 있습니다.",
                actionLabel: "상세 보기",
                actionLink: "sheet:facilities"
            },
            {
                type: 'nearby',
                icon: <Mountain className="w-5 h-5 text-[#3C6E47] group-hover:text-[#1C4526] transition-colors mb-2" />,
                label: "주변 명소",
                sub: "관광지 안내",
                title: "주변 즐길거리",
                description: "캠핑장 주변의 행사와 축제, 관광지를 확인해보세요.",
                actionLabel: "주변 정보 확인",
                actionLink: "sheet:nearby"
            },
            {
                type: 'price',
                icon: <Tag className="w-5 h-5 text-[#3C6E47] group-hover:text-[#1C4526] transition-colors mb-2" />,
                label: "가격안내",
                sub: "요금표",
                title: "가격 안내",
                description: "상세 이용 요금 안내입니다.",
                isPriceGuide: true
            },
        ];
    }, [config]);

    // Auth Protection Hook
    const { withAuth } = useRequireAuth();

    const handleProtectedAction = useCallback((action: () => void) => {
        withAuth(action);
    }, [withAuth]);

    const handleChipClick = useCallback((chip: BeginnerChip) => {
        if (chip.isPriceGuide) return; // Handled by PriceGuideSheet wrapper in render
        if (!config) return;

        // 1. Copy Address
        if (chip.actionLink?.startsWith("copy:")) {
            const text = chip.actionLink.split(':')[1];
            navigator.clipboard.writeText(text);
            toast.success("주소가 복사되었습니다");
            return;
        }

        // 2. Navigation Sheet
        if (chip.actionLink === "sheet:navigation") {
            setDetailData({
                ...chip,
                description: chip.description + "\n\n👇 원하시는 지도 앱을 선택해주세요.",
                actionLabel: undefined,
                buttons: [
                    {
                        label: "네이버 지도",
                        onClick: () => window.location.href = `https://map.naver.com/v5/search/${encodeURIComponent(config.address_main || '')}`,
                        variant: 'outline'
                    },
                    {
                        label: "카카오맵",
                        onClick: () => window.location.href = `https://map.kakao.com/link/search/${encodeURIComponent(config.address_main || '')}`,
                        variant: 'outline'
                    }
                ]
            });
            setDetailSheetOpen(true);
            return;
        }

        // 3. Contact Sheet
        if (chip.actionLink === "sheet:contact") {
            setDetailData({
                ...chip,
                description: "문의 사항이 있으신가요?\n전화 연결 또는 번호를 복사할 수 있습니다.",
                actionLabel: undefined,
                buttons: [
                    {
                        label: "전화 걸기",
                        onClick: () => window.location.href = `tel:${config.phone_number || ''}`,
                        variant: 'default'
                    },
                    {
                        label: "전화번호 복사",
                        onClick: () => {
                            navigator.clipboard.writeText(config.phone_number || '');
                            toast.success("전화번호가 복사되었습니다");
                        },
                        variant: 'outline'
                    }
                ]
            });
            setDetailSheetOpen(true);
            return;
        }

        // 5. Facilities Sheet
        if (chip.actionLink === "sheet:facilities") {
            setFacilitySheetOpen(true);
            return;
        }

        // 6. Nearby Sheet (LBS) - FIXED LOCATION for Chip
        if (chip.actionLink === "sheet:nearby") {
            setNearbyEvents([]); // Or load via API
            setSearchLocation(DEFAULT_CAMPING_LOCATION); // Use RAON.I Location
            setNearbyDescription("라온아이 캠핑장 근처 관광지와 편의시설을 확인하세요");
            setNearbySheetOpen(true);
            return;
        }

        // Default Sheet (Rules etc)
        setDetailData(chip);
        setDetailSheetOpen(true);
    }, [config]);

    const handleRecommendationClick = useCallback((item: RecommendationItem, reason?: string) => {
        withAuth(async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            // --- [Phase 3] Curation Card Sensors (No 26-28) ---
            if (user) {
                if (item.title?.includes('바다 앞')) {
                    await dispatchPersonaAction(user.id, 'LBS_CLICK_OCEAN_VIBE');
                } else if (item.title?.includes('깊은 산속')) {
                    await dispatchPersonaAction(user.id, 'LBS_CLICK_MOUNTAIN_VIBE');
                } else if (item.title?.includes('계곡 물놀이')) {
                    await dispatchPersonaAction(user.id, 'LBS_CLICK_VALLEY_VIBE');
                }
            }

            // Special Handling for LBS Card
            if (item.type === 'nearby_lbs') {
                setNearbyEvents(item.events || []);
                setSearchLocation(lbs.location || undefined); // Use User Location
                setNearbyDescription("주변 반경 30km의 레포츠,관광지,편의시설,행사를 확인하세요");
                setNearbySheetOpen(true);

                // --- [Phase 3.5] Progressive Trigger Injection: LBS (Nearby Check) ---
                (async () => {
                    const supabase = createClient();
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        await dispatchPersonaAction(user.id, 'LBS_NEARBY_CLICK');
                    }
                })();
                return;
            }

            // Cooking Category -> RecipeDetailSheet
            if (item.category === 'cooking') {
                // Map RecommendationItem to RecipeData
                setRecipeData({
                    id: (item as any).id || 'unknown',
                    title: item.title,
                    description: item.description || undefined,
                    category: 'cooking',
                    image_url: item.image_url || undefined,
                    ingredients: item.ingredients as any,
                    steps: item.process_steps as any || item.steps as any,
                    tips: item.tips || undefined,
                    time_required: item.time_required || undefined,
                    difficulty: item.difficulty || undefined,
                    servings: item.servings || undefined,
                    calories: item.calories || undefined,
                });
                setRecipeSheetOpen(true);
                return;
            }

            setDetailData({
                title: item.title,
                description: item.description || "이 활동은 라온아이에서 추천하는 특별한 경험입니다.",
                icon: <span className="text-4xl">{item.icon}</span>,
                actionLabel: item.actionLabel,
                actionLink: item.actionLink,
                bgColorClass: item.bgColorClass,
                categoryLabel: item.category === 'play' ? '오늘의 놀이' : '오늘의 셰프',
                ingredients: item.ingredients as string[] | { name: string; amount: string; }[] | undefined,
                steps: item.process_steps as string[] | undefined,
                tips: item.tips || undefined,
                time_required: item.time_required || undefined,
                difficulty: item.difficulty || undefined,
                image_url: item.image_url || undefined,
                servings: item.servings || undefined,
                calories: item.calories || undefined,
                age_group: item.age_group || undefined,
                location_type: item.location_type || undefined,
                reason: reason,
                category: item.category as 'cooking' | 'play'
            });
            setDetailSheetOpen(true);
        });
    }, [withAuth, lbs]);

    if (!isMounted) {
        return (
            <div className="flex flex-col w-full min-h-screen bg-white dark:bg-black relative items-center justify-center text-stone-400 text-sm">
                로딩 중...
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full min-h-screen bg-white dark:bg-black relative">
            <TopBar />

            <main className="flex-1 pb-24 overflow-y-auto scrollbar-hide">
                {/* 미작성 일정이 있을 때 홈화면 최상단에 리마인더 배너 노출 */}
                <AnimatePresence>
                    {unwrittenScheduleDetail && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="px-0"
                        >
                            <ReminderBanner
                                detail={unwrittenScheduleDetail}
                                onClick={() => setIsRecordOpen(true)}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* 1. Hero Section */}
                <section className="relative w-full h-[50vh] min-h-[460px] flex flex-col justify-end p-6">
                    <div className="absolute inset-0 z-0 bg-stone-300">
                        {/* Hero Image */}
                        <div
                            className="w-full h-full bg-cover bg-center grayscale-[20%]"
                            style={{ backgroundImage: config?.hero_image_url ? `url(${config.hero_image_url})` : `url('https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?q=80&w=1000&auto=format&fit=crop')` }}
                        />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />

                    <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between gap-3">
                        <SlimNotice variant="hero" />
                        <NotificationBadge variant="hero" />
                    </div>

                    <div className="relative z-20 text-white space-y-2 mb-16 w-full text-center">
                        <p className="text-white/90 text-lg mb-4 leading-relaxed font-medium">
                            {recData.context ? recData.context.greeting : '반가워요, 캠퍼님'}
                        </p>
                        
                        <span className="tracking-[0.2em] font-black text-white/90 text-[18px] block mb-5 pl-[0.2em]">
                            나만의 스마트 여행수첩
                        </span>

                        <div className="py-1 w-full">
                            <div className="w-36 h-[2px] bg-white/30 mx-auto my-2" />
                            <span className="tracking-[0.4em] font-bold text-white/95 text-[30px] text-center block pl-[0.4em]">라 온 아 이</span>
                            <div className="w-36 h-[2px] bg-white/30 mx-auto my-2" />
                        </div>
                    </div>
                </section>

                {/* Card 1: 라온아이캠핑장 소개 · 예약하기 */}
                <div className="px-4 mt-4 relative z-30 mb-4">
                    <button
                        onClick={() => setIsIntroExpanded(!isIntroExpanded)}
                        className="w-full flex items-center justify-between px-6 py-6 bg-white dark:bg-zinc-900 border-[3px] border-[#4F8F75] rounded-2xl shadow-[0_6px_20px_-4px_rgba(0,0,0,0.12)] hover:bg-[#F0F7F4] dark:hover:bg-zinc-800/80 active:scale-[0.99] transition-all duration-200 text-left cursor-pointer group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-[#4F8F75] text-white rounded-xl">
                                <Tent className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-[#4F8F75] dark:text-stone-200 tracking-tight leading-tight">
                                    라온아이캠핑장<br />소개 · 예약하기
                                </h3>
                            </div>
                        </div>
                        <div className={`text-[#4F8F75] dark:text-stone-300 p-2 bg-white/60 dark:bg-zinc-950/60 rounded-full transition-transform duration-300 ${isIntroExpanded ? 'rotate-180' : 'animate-pulse'}`}>
                            <ChevronDown className="w-5 h-5" />
                        </div>
                    </button>
                </div>

                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ 
                        height: isIntroExpanded ? 'auto' : 0, 
                        opacity: isIntroExpanded ? 1 : 0 
                    }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                >
                            {/* 2. Info Chips */}
                            <section className="px-4 mb-6 animate-in fade-in duration-300">
                                <div className="grid grid-cols-3 gap-3">
                                    {chips.map((chip, idx) => {
                                        const ChipContent = (
                                            <div
                                                onClick={() => handleChipClick(chip)}
                                                className="flex flex-col items-center justify-center aspect-square bg-[#FAF9F6]/95 dark:bg-zinc-800/95 backdrop-blur-md rounded-2xl shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08)] border border-stone-200/50 dark:border-zinc-700/50 hover:bg-[#F5F2EA] dark:hover:bg-zinc-700 hover:scale-[1.02] transition-all duration-300 p-2 cursor-pointer group touch-feedback-soft"
                                            >
                                                {chip.icon}
                                                <p className="text-responsive-chip-label font-bold text-stone-700 dark:text-stone-300 group-hover:text-stone-900 dark:group-hover:text-stone-100 text-center leading-tight transition-colors">{chip.label}</p>
                                                <p className="text-responsive-badge text-stone-400 group-hover:text-[#C3A675] mt-1 transition-colors">{chip.sub}</p>
                                            </div>
                                        );

                                        if (chip.isPriceGuide) {
                                            return (
                                                <PriceGuideSheet key={idx} pricingText={config?.pricing_guide_text}>
                                                    {ChipContent}
                                                </PriceGuideSheet>
                                            )
                                        }
                                        return <div key={idx}>{ChipContent}</div>
                                    })}
                                </div>
                            </section>

                            {/* 2.5 Marketing USP Banner */}
                            <section className="px-4 mb-6">
                                <div className="w-full bg-[#ECE8DF]/60 dark:bg-zinc-900/40 backdrop-blur-sm rounded-3xl p-5 border border-stone-200/40 dark:border-zinc-800 text-center space-y-2.5">
                                    <p className="text-base font-bold text-[#1C4526] dark:text-[#C3A675] leading-relaxed">
                                        두가족도 넉넉한 2배사이트, 깨끗한 개별욕실
                                    </p>
                                    <p className="text-sm text-stone-600 dark:text-stone-400 font-semibold">
                                        라온아이에서 불편은 덜고, 추억은 쌓으세요.
                                    </p>
                                </div>
                            </section>

                            {/* 3. Guide Card */}
                            <section className="px-4 mb-6">
                                <div className="w-full bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-stone-100 dark:border-zinc-800">
                                    <h3 className="text-xl font-bold text-[#1C4526] mb-4">처음 오셨나요?</h3>
                                    <div className="space-y-6">
                                        <div className="flex gap-4">
                                            <div className="flex-none flex items-center justify-center w-8 h-8 rounded-full bg-[#E8F5E9] text-[#1C4526] font-bold">1</div>
                                            <div>
                                                <h4 className="font-semibold text-stone-900 dark:text-stone-100">예약하기</h4>
                                                <p className="text-sm text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                                                    원하는 날짜와 사이트를 선택하세요.<br />
                                                    여유로운 캠핑을 위해 미리 준비하면 좋아요.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="flex-none flex items-center justify-center w-8 h-8 rounded-full bg-[#E8F5E9] text-[#1C4526] font-bold">2</div>
                                            <div>
                                                <h4 className="font-semibold text-stone-900 dark:text-stone-100">입,퇴실 안내</h4>
                                                <p className="text-sm text-stone-600 dark:text-stone-400 mt-1 leading-relaxed break-keep">
                                                    오후 2시 입실, 낮 12시 퇴실입니다.<br />
                                                    앞,뒤 예약자가 없으면 여유로운 입,퇴실이 가능합니다.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        className="w-full mt-6 bg-[#1C4526] hover:bg-[#224732] text-white rounded-xl h-12 shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
                                        onClick={() => handleProtectedAction(() => router.push('/reservation'))}
                                    >
                                        예약 가능 날짜 보기
                                    </Button>
                                    <p className="text-center text-xs text-stone-400 mt-2">
                                        {format(openDayRule?.closeAt || OPEN_DAY_CONFIG.closeAt, 'MM월 dd일')}까지 예약 가능합니다.
                                    </p>
                                </div>
                            </section>
                </motion.div>

                {/* Card 2: 여행계획 자동생성 · 여행일정 관리 */}
                <div className="px-4 mb-4">
                    <button
                        onClick={() => setIsScheduleExpanded(!isScheduleExpanded)}
                        className="w-full flex items-center justify-between px-6 py-6 bg-white dark:bg-zinc-900 border-[3px] border-[#5B8DA5] rounded-2xl shadow-[0_6px_20px_-4px_rgba(0,0,0,0.12)] hover:bg-[#F1F6F9] dark:hover:bg-zinc-800/80 active:scale-[0.99] transition-all duration-200 text-left cursor-pointer group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-[#5B8DA5] text-white rounded-xl">
                                <Calendar className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-[#5B8DA5] dark:text-stone-200 tracking-tight leading-tight">
                                    여행계획 자동생성<br />· 여행일정 관리
                                </h3>
                            </div>
                        </div>
                        <div className={`text-[#5B8DA5] dark:text-stone-300 p-2 bg-white/60 dark:bg-zinc-950/60 rounded-full transition-transform duration-300 ${isScheduleExpanded ? 'rotate-180' : 'animate-pulse'}`}>
                            <ChevronDown className="w-5 h-5" />
                        </div>
                    </button>
                </div>

                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ 
                        height: isScheduleExpanded ? 'auto' : 0, 
                        opacity: isScheduleExpanded ? 1 : 0 
                    }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                >
                            {/* 3.6 Schedule Widget */}
                            <section className="px-4 mb-6">
                                <ScheduleHomeWidget isExpanded={isScheduleExpanded} />
                            </section>
                </motion.div>

                {/* Card 3: 소소한 챙김 */}
                <div className="px-4 mb-8">
                    <button
                        onClick={() => setSosoCareSheetOpen(true)}
                        className="w-full flex items-center justify-between px-6 py-6 bg-white dark:bg-zinc-900 border-[3px] border-[#9F8E80] rounded-2xl shadow-[0_6px_20px_-4px_rgba(0,0,0,0.12)] hover:bg-[#F9F7F5] dark:hover:bg-zinc-800/80 active:scale-[0.99] transition-all duration-200 text-left cursor-pointer group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-[#9F8E80] text-white rounded-xl">
                                <ChefHat className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-[#9F8E80] dark:text-stone-200 tracking-tight leading-tight">소소한 챙김</h3>
                                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 font-medium">주간 미션, 캠핑 요리 레시피, 놀이 탐색기</p>
                            </div>
                        </div>
                        <div className="text-[#9F8E80] dark:text-stone-300 p-2 bg-white/60 dark:bg-zinc-950/60 rounded-full">
                            <ChevronRight className="w-5 h-5" />
                        </div>
                    </button>
                </div>
            </main>



            <HomeDetailSheet
                isOpen={detailSheetOpen}
                onClose={() => setDetailSheetOpen(false)}
                data={detailData}
                onShuffle={shuffle}
            />

            <RecipeDetailSheet
                isOpen={recipeSheetOpen}
                onClose={() => setRecipeSheetOpen(false)}
                initialData={recipeData}
            />

            {
                weather && (
                    <WeatherDetailSheet
                        isOpen={weatherSheetOpen}
                        onClose={() => setWeatherSheetOpen(false)}
                        weather={weather}
                    />
                )
            }

            {/* Live LBS Events Sheet */}
            <NearbyDetailSheet
                isOpen={nearbySheetOpen}
                onClose={() => setNearbySheetOpen(false)}
                events={nearbyEvents.map(e => ({
                    id: e.id,
                    title: e.title,
                    description: e.addr1 || '',
                    location: e.location || e.addr1 || null,
                    start_date: e.start_date || e.eventstartdate || null,
                    end_date: e.end_date || e.eventenddate || null,
                    image_url: e.image_url || e.firstimage || null,
                    latitude: e.mapy || null,
                    longitude: e.mapx || null,
                    // Optional fields
                    detail_url: null,
                    source: 'tourapi'
                }))}
                facilities={[]}
                userLocation={searchLocation || lbs.location}
                getDistance={lbs.getDistanceKm}
                isUsingDefault={!searchLocation && !lbs.location}
                customDescription={nearbyDescription}
            />

            {/* Facility Details */}
            {
                config && (
                    <FacilityDetailSheet
                        isOpen={facilitySheetOpen}
                        onClose={() => setFacilitySheetOpen(false)}
                        layoutImage={config.layout_image_url}
                        bathroomImages={config.bathroom_images}
                        siteImages={config.site_images}
                        description={config.facilities_description}
                    />
                )
            }

            {/* 10초 기록 팝업 시트 바인딩 */}
            <QuickRecordForm
                isOpen={isRecordOpen}
                onClose={() => setIsRecordOpen(false)}
                scheduleId={unwrittenScheduleIds[0]}
                onSuccess={() => {
                    refresh();
                    fetchMyReservations();
                }}
            />

            {/* 지도 모달 바인딩 */}
            <MyMapModal
                isOpen={isMapOpen}
                onClose={() => setIsMapOpen(false)}
            />

            {/* 소소한 챙김 바텀 시트 */}
            <Sheet open={sosoCareSheetOpen} onOpenChange={setSosoCareSheetOpen}>
                <SheetContent side="bottom" className="rounded-t-3xl pb-8 max-h-[90vh] overflow-y-auto bg-[#F7F5EF] dark:bg-zinc-950">
                    <SheetHeader className="mb-4">
                        <SheetTitle className="text-base font-black text-stone-900 dark:text-stone-100">🌿 소소한 챙김</SheetTitle>
                        <SheetDescription className="text-xs text-stone-500 dark:text-stone-400">
                            캠핑을 더욱 풍성하고 기분 좋게 해줄 작은 즐거움들을 만나보세요
                        </SheetDescription>
                    </SheetHeader>
                    
                    <div className="flex flex-col gap-4 mt-2">
                        {/* 1. 주간 미션 위젯 */}
                        <div className="w-full">
                            <p className="text-xs font-bold text-stone-400 dark:text-stone-500 mb-1.5 pl-1">🎯 주간 미션 챌린지</p>
                            <MissionHomeWidget />
                        </div>

                        {/* 2. 레시피 탐색기 배너 */}
                        <div className="w-full">
                            <p className="text-xs font-bold text-stone-400 dark:text-stone-500 mb-1.5 pl-1">📖 맛있는 식사 준비</p>
                            <div 
                                onClick={() => {
                                    setSosoCareSheetOpen(false);
                                    handleProtectedAction(() => router.push('/recipe'));
                                }}
                                className="group relative w-full bg-gradient-to-r from-[#224732] to-[#1a3626] hover:from-[#1a3626] hover:to-[#0f2117] text-white rounded-2xl p-4 border border-[#224732]/30 shadow-md active:scale-[0.99] transition-all cursor-pointer overflow-hidden"
                            >
                                <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-10 text-white pointer-events-none">
                                    <ChefHat className="w-24 h-24" />
                                </div>
                                <div className="relative z-10 flex justify-between items-center">
                                    <div className="space-y-0.5 text-left">
                                        <h3 className="text-sm font-bold tracking-tight">여행 & 캠핑 레시피 탐색기</h3>
                                        <p className="text-[10px] text-white/80">터치 2번으로 고르는 맞춤 요리 정보와 꿀팁 영상</p>
                                    </div>
                                    <div className="bg-white/10 p-1.5 rounded-xl group-hover:bg-white/20 transition-all">
                                        <ChevronRight className="w-4 h-4 text-white" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. 놀이 탐색기 배너 */}
                        <div className="w-full">
                            <p className="text-xs font-bold text-stone-400 dark:text-stone-500 mb-1.5 pl-1">🎲 신나는 가족 활동</p>
                            <div 
                                onClick={() => {
                                    setSosoCareSheetOpen(false);
                                    handleProtectedAction(() => router.push('/play'));
                                }}
                                className="group relative w-full bg-gradient-to-r from-amber-700 to-orange-600 hover:from-amber-600 hover:to-orange-500 text-white rounded-2xl p-4 border border-amber-800/50 shadow-md active:scale-[0.99] transition-all cursor-pointer overflow-hidden"
                            >
                                <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-10 text-white pointer-events-none">
                                    <Tent className="w-24 h-24" />
                                </div>
                                <div className="relative z-10 flex justify-between items-center">
                                    <div className="space-y-0.5 text-left">
                                        <h3 className="text-sm font-bold tracking-tight">여행 & 캠핑 놀이 탐색기</h3>
                                        <p className="text-[10px] text-white/80">어디서든 심심할 틈 없는 맞춤 놀이 추천</p>
                                    </div>
                                    <div className="bg-white/10 p-1.5 rounded-xl group-hover:bg-white/20 transition-all">
                                        <ChevronRight className="w-4 h-4 text-white" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div >
    );
}
