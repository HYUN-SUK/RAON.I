import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Phone, Map, Mountain, Tag, Tent, Clock, Wifi, ShoppingBag, Siren } from 'lucide-react';
import TopBar from '@/components/TopBar';
import NotificationBadge from '@/components/common/NotificationBadge';
import SlimNotice from '@/components/home/SlimNotice';
import { PriceGuideSheet } from '@/components/home/PriceGuideSheet';
import RecommendationGrid from '@/components/home/RecommendationGrid';
import MissionHomeWidget from '@/components/home/MissionHomeWidget';
import HomeDetailSheet, { HomeDetailData } from '@/components/home/HomeDetailSheet';
import WeatherDetailSheet from '@/components/home/WeatherDetailSheet';
import NearbyDetailSheet from '@/components/home/NearbyDetailSheet';
import FacilityDetailSheet from '@/components/home/FacilityDetailSheet';

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

    // Contextual Data
    const { data: recData, loading: recLoading, weather, shuffle } = usePersonalizedRecommendation();
    const { openDayRule, fetchOpenDayRule } = useReservationStore();
    const { requestPermission } = usePushNotification();

    React.useEffect(() => {
        fetchOpenDayRule();
        requestPermission();
    }, [fetchOpenDayRule, requestPermission]);

    // Bottom Sheet State
    const [detailSheetOpen, setDetailSheetOpen] = useState(false);
    const [weatherSheetOpen, setWeatherSheetOpen] = useState(false);
    const [detailData, setDetailData] = useState<HomeDetailData | null>(null);

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

        // Fixed 6 Chips per User Request:
        // 1. Wayfinding (Address)
        // 2. Contact (Phone)
        // 3. Rules (Manners)
        // 4. Facilities (Map + Images)
        // 5. Nearby Places (LBS - Fixed relative to Campsite for Chip)
        // 6. Price Guide

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

    // Generic Icon Mapping
    const getIconComponent = (iconName: string) => {
        switch (iconName) {
            case 'Tent': return <Tent className="w-5 h-5 text-[#3C6E47] group-hover:text-[#1C4526] transition-colors mb-2" />;
            case 'Clock': return <Clock className="w-5 h-5 text-[#3C6E47] group-hover:text-[#1C4526] transition-colors mb-2" />;
            case 'Map': return <Map className="w-5 h-5 text-[#3C6E47] group-hover:text-[#1C4526] transition-colors mb-2" />;
            case 'Wifi': return <Wifi className="w-5 h-5 text-[#3C6E47] group-hover:text-[#1C4526] transition-colors mb-2" />;
            case 'ShoppingBag': return <ShoppingBag className="w-5 h-5 text-[#3C6E47] group-hover:text-[#1C4526] transition-colors mb-2" />;
            case 'Siren': return <Siren className="w-5 h-5 text-[#3C6E47] group-hover:text-[#1C4526] transition-colors mb-2" />;
            case 'MapPin': return <MapPin className="w-5 h-5 text-[#3C6E47] group-hover:text-[#1C4526] transition-colors mb-2" />;
            case 'Navigation': return <Navigation className="w-5 h-5 text-[#3C6E47] group-hover:text-[#1C4526] transition-colors mb-2" />;
            case 'Phone': return <Phone className="w-5 h-5 text-[#3C6E47] group-hover:text-[#1C4526] transition-colors mb-2" />;
            case 'Mountain': return <Mountain className="w-5 h-5 text-[#3C6E47] group-hover:text-[#1C4526] transition-colors mb-2" />;
            default: return <Tag className="w-5 h-5 text-[#3C6E47] group-hover:text-[#1C4526] transition-colors mb-2" />;
        }
    };

    // Auth Protection Hook
    const { withAuth } = useRequireAuth();

    const handleProtectedAction = (action: () => void) => {
        withAuth(action);
    };

    const handleChipClick = (chip: BeginnerChip) => {
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
    };

    const handleRecommendationClick = (item: RecommendationItem, reason?: string) => {
        withAuth(() => {
            // Special Handling for LBS Card
            if (item.type === 'nearby_lbs') {
                setNearbyEvents(item.events || []);
                setSearchLocation(lbs.location || undefined); // Use User Location
                setNearbyDescription("주변 반경 30km의 레포츠,관광지,편의시설,행사를 확인하세요");
                setNearbySheetOpen(true);
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
    };

    return (
        <div className="flex flex-col w-full min-h-screen bg-[#F7F5EF] dark:bg-black relative">
            <TopBar />

            <main className="flex-1 pb-24 overflow-y-auto scrollbar-hide">
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

                    <NotificationBadge variant="hero" />

                    <div className="relative z-20 text-white space-y-4 mb-6">

                        {/* Always show content, use default values during loading */}

                        {/* Weather/Greeting Badge */}
                        <Badge
                            variant="secondary"
                            className="bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm border-none px-3 py-1 cursor-pointer transition-colors"
                            onClick={() => weather && setWeatherSheetOpen(true)}
                        >
                            {recData.context?.weather && recData.context?.weather !== 'unknown'
                                ? `${recData.context.temp !== null ? Math.round(recData.context.temp) + '°C ' : ''}${recData.context.greeting}`
                                : recLoading ? 'Loading...' : 'Welcome to RAON.I'
                            }
                        </Badge>
                        <p className="text-[10px] text-white/60 animate-pulse mb-2 ml-1">👆 터치하여 상세 날씨 보기</p>

                        {/* Title - Immediate Render */}
                        <h1 className="text-responsive-hero-title font-bold leading-tight">
                            {recData.context?.time === 'morning' ? '상쾌한 아침,\n' :
                                recData.context?.time === 'night' ? '고요한 밤,\n' :
                                    recData.context?.time === 'evening' ? '아름다운 저녁,\n' :
                                        '반가워요,\n'}
                        </h1>

                        {/* Subtitle - Immediate Render */}
                        <p className="text-responsive-hero-sub font-semibold text-white/95 drop-shadow-md">
                            두가족도 넉넉한 2배사이트, 깨끗한 개별욕실<br />
                            라온아이에서 불편은 덜고, 추억은 쌓으세요.
                        </p>
                    </div>
                </section>

                {/* 2. Info Chips (3x2 Grid) */}
                <section className="px-4 -mt-8 relative z-30 mb-8">
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

                {/* 3. Guide Card */}
                <section className="px-4 mb-8">
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

                {/* 3.5 Mission Widget */}
                <section className="px-4 mb-8">
                    <MissionHomeWidget />
                </section>

                {/* 4. Recommendations Grid */}
                <RecommendationGrid
                    data={recData}
                    loading={recLoading}
                    onItemClick={handleRecommendationClick as any}
                />
            </main>

            <div className="absolute bottom-0 left-0 right-0 z-40">
                <SlimNotice />
            </div>

            <HomeDetailSheet
                isOpen={detailSheetOpen}
                onClose={() => setDetailSheetOpen(false)}
                data={detailData}
                onShuffle={shuffle}
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

            {/* Live LBS Events Sheet (Contextual Recommendation) */}
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
        </div >
    );
}
