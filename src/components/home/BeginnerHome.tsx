import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Phone, Map, Mountain, Tag, Tent, Clock, Wifi, ShoppingBag, Siren } from 'lucide-react';
import TopBar from '@/components/TopBar';
import SlimNotice from '@/components/home/SlimNotice';
import { PriceGuideSheet } from '@/components/home/PriceGuideSheet';
import RecommendationGrid from '@/components/home/RecommendationGrid';
import MissionHomeWidget from '@/components/home/MissionHomeWidget';
import HomeDetailSheet, { HomeDetailData } from '@/components/home/HomeDetailSheet';
import NearbyDetailSheet from '@/components/home/NearbyDetailSheet';
import { OPEN_DAY_CONFIG } from '@/constants/reservation';
import { format } from 'date-fns';

import { toast } from "sonner";
import { createClient } from "@/lib/supabase-client";
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { useLBS } from '@/hooks/useLBS';
import { usePersonalizedRecommendation } from '@/hooks/usePersonalizedRecommendation';

export default function BeginnerHome() {
    const router = useRouter();
    const supabase = createClient();
    const { config } = useSiteConfig(); // Dynamic Config
    const lbs = useLBS(); // Real-time Location

    // Contextual Data
    const { data: recData, loading: recLoading } = usePersonalizedRecommendation();

    // Bottom Sheet State
    const [detailSheetOpen, setDetailSheetOpen] = useState(false);
    const [detailData, setDetailData] = useState<HomeDetailData | null>(null);

    // Nearby LBS Sheet State
    const [nearbySheetOpen, setNearbySheetOpen] = useState(false);
    const [nearbyEvents, setNearbyEvents] = useState<any[]>([]);

    // Dynamic Chip Data
    const [chips, setChips] = useState<(HomeDetailData & { label: string; sub: string; isPriceGuide?: boolean; type?: string })[]>([]);

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

    useEffect(() => {
        if (!config) return;

        // Fixed 6 Chips per User Request:
        // 1. Wayfinding (Address)
        // 2. Contact (Phone)
        // 3. Rules (Manners)
        // 4. Facilities (Map)
        // 5. Nearby Places
        // 6. Price Guide

        setChips([
            {
                type: 'wayfinding',
                icon: <Navigation className="w-5 h-5 text-[#3C6E47] group-hover:text-[#1C4526] transition-colors mb-2" />,
                label: "길찾기",
                sub: "카카오/티맵",
                title: "오시는 길",
                description: `주소: ${config.address_main}\n(상세: ${config.address_detail || '없음'})\n\n화악산의 맑은 공기와 함께하는 여정이 되시길 바랍니다.`,
                actionLabel: "네비게이션 앱 선택",
                actionLink: "sheet:navigation"
            },
            {
                type: 'contact',
                icon: <Phone className="w-5 h-5 text-[#3C6E47] group-hover:text-[#1C4526] transition-colors mb-2" />,
                label: "문의",
                sub: "연락처",
                title: "문의 하기",
                description: `예약 및 이용 관련 문의는 언제든 편하게 연락주세요.\n\n📞 ${config.phone_number}`,
                actionLabel: "전화 연결",
                actionLink: "sheet:contact"
            },
            {
                type: 'rules',
                icon: <Clock className="w-5 h-5 text-[#3C6E47] group-hover:text-[#1C4526] transition-colors mb-2" />,
                label: "이용수칙",
                sub: "매너타임 외",
                title: "이용 수칙 안내",
                description: config.rules_guide_text || "모두가 행복한 캠핑을 위해 이용 수칙을 준수해주세요.\n\n매너타임: 22:00 ~ 08:00\n(상세 수칙은 관리자에게 문의하세요)",
                actionLabel: "확인",
                actionLink: "#"
            },
            {
                type: 'map',
                icon: <Map className="w-5 h-5 text-[#3C6E47] group-hover:text-[#1C4526] transition-colors mb-2" />,
                label: "시설현황",
                sub: "배치도",
                title: "시설 배치도",
                description: "전체 캠핑장 배치도입니다.\n이미지를 확대해서 보실 수 있습니다.",
                actionLabel: "크게 보기",
                actionLink: config.layout_image_url ? `image:${config.layout_image_url}` : undefined
            },
            {
                type: 'nearby',
                icon: <Mountain className="w-5 h-5 text-[#3C6E47] group-hover:text-[#1C4526] transition-colors mb-2" />,
                label: "주변 명소",
                sub: "관광지 안내",
                title: "주변 즐길거리",
                description: Array.isArray(config.nearby_places) && config.nearby_places.length > 0
                    ? (config.nearby_places as any[]).map(p => `• ${p.title}\n  ${p.desc}`).join('\n\n')
                    : "등록된 인근 명소가 없습니다.",
                actionLabel: "명소 리스트 확인",
                actionLink: "/guide/scenery" // Or Keep as sheet logic if preferable
            },
            {
                type: 'price',
                icon: <Tag className="w-5 h-5 text-[#3C6E47] group-hover:text-[#1C4526] transition-colors mb-2" />,
                label: "가격안내",
                sub: "요금표",
                title: "가격 안내",
                description: config.pricing_guide_text || "가격 정보가 등록되지 않았습니다.",
                isPriceGuide: true
            },
        ]);
    }, [config]);

    const handleProtectedAction = async (action: () => void) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            toast.info("로그인 후 서비스 이용이 가능합니다", {
                description: "라온아이의 모든 혜택을 누려보세요!",
                action: {
                    label: "로그인",
                    onClick: () => router.push('/login')
                }
            });
            return;
        }
        action();
    };

    const handleChipClick = (chip: any) => {
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
                actionLabel: undefined, // Disable default button
                buttons: [
                    {
                        label: "네이버 지도",
                        onClick: () => window.location.href = `https://map.naver.com/v5/search/${encodeURIComponent(config.address_main)}`,
                        variant: 'outline'
                    },
                    {
                        label: "카카오맵",
                        onClick: () => window.location.href = `https://map.kakao.com/link/search/${encodeURIComponent(config.address_main)}`,
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
                        onClick: () => window.location.href = `tel:${config.phone_number}`,
                        variant: 'default'
                    },
                    {
                        label: "전화번호 복사",
                        onClick: () => {
                            navigator.clipboard.writeText(config.phone_number);
                            toast.success("전화번호가 복사되었습니다");
                        },
                        variant: 'outline'
                    }
                ]
            });
            setDetailSheetOpen(true);
            return;
        }

        // Default Sheet
        setDetailData(chip);
        setDetailSheetOpen(true);
    };

    const handleRecommendationClick = (item: any) => {
        // Special Handling for LBS Card
        if (item.type === 'nearby_lbs') {
            setNearbyEvents(item.events || []);
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
            // V2 Fields Copy
            categoryLabel: item.category === 'play' ? '오늘의 놀이' : '오늘의 셰프',
            ingredients: item.ingredients || item.materials,
            steps: item.process_steps, // DB field is process_steps, UI prop is steps
            tips: item.tips,
            time_required: item.time_required,
            difficulty: item.difficulty,

            // V2.1 Premium Fields
            image_url: item.image_url,
            servings: item.servings,
            calories: item.calories,
            age_group: item.age_group,
            location_type: item.location_type
        });
        setDetailSheetOpen(true);
    };

    return (
        <div className="flex flex-col w-full min-h-screen bg-[#F7F5EF] dark:bg-black relative">
            {/* Global TopBar */}
            <TopBar />

            <main className="flex-1 pb-24 overflow-y-auto scrollbar-hide">
                {/* 1. Hero Section */}
                <section className="relative w-full h-[50vh] min-h-[460px] flex flex-col justify-end p-6">
                    {/* Background Image (Placeholder) */}
                    <div className="absolute inset-0 z-0 bg-stone-300">
                        {/* Placeholder for Hero Image */}
                        <div className="w-full h-full bg-stone-400 bg-[url('https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center grayscale-[20%]" />
                    </div>

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />

                    <div className="relative z-20 text-white space-y-4 mb-6">
                        {recLoading ? (
                            <div className="space-y-4 animate-pulse">
                                <Skeleton className="h-7 w-32 bg-white/20 rounded-full" />
                                <div className="space-y-2">
                                    <Skeleton className="h-10 w-48 bg-white/20 rounded-lg" />
                                    <Skeleton className="h-10 w-36 bg-white/20 rounded-lg" />
                                </div>
                                <div className="space-y-1 pt-2">
                                    <Skeleton className="h-5 w-full max-w-[280px] bg-white/20 rounded-md" />
                                    <Skeleton className="h-5 w-full max-w-[240px] bg-white/20 rounded-md" />
                                </div>
                            </div>
                        ) : (
                            <>
                                <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm border-none px-3 py-1">
                                    {recData.context?.weather
                                        ? `${recData.context.temp !== null ? recData.context.temp + '°C ' : ''}${recData.context.greeting}`
                                        : 'Welcome to RAON.I'
                                    }
                                </Badge>
                                <h1 className="text-3xl font-bold leading-tight">
                                    {recData.context?.time === 'morning' ? '상쾌한 아침,\n' :
                                        recData.context?.time === 'night' ? '고요한 밤,\n' :
                                            '처음이신가요?\n'}
                                </h1>
                                <p className="text-lg font-semibold text-white/95 leading-snug drop-shadow-md">
                                    두가족도 넉넉한 2배사이트, 깨끗한 개별욕실<br />
                                    라온아이에서 불편은 덜고, 추억은 쌓으세요.
                                </p>
                            </>
                        )}
                    </div>
                </section>


                {/* 2. Info Chips (3x2 Grid) */}
                <section className="px-4 -mt-8 relative z-30 mb-8">
                    <div className="grid grid-cols-3 gap-3">
                        {chips.map((chip, idx) => {
                            // ChipIcon is already a ReactNode in my new state logic, 
                            // BUT wait, in state above I set icon: <MapPin ... /> (JSX Element).
                            // So I just render it directly.

                            const ChipContent = (
                                <div
                                    onClick={() => handleChipClick(chip)}
                                    className="flex flex-col items-center justify-center aspect-square bg-[#FAF9F6]/95 dark:bg-zinc-800/95 backdrop-blur-md rounded-2xl shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08)] border border-stone-200/50 dark:border-zinc-700/50 hover:bg-[#F5F2EA] dark:hover:bg-zinc-700 hover:scale-[1.02] transition-all duration-300 p-2 cursor-pointer group"
                                >
                                    {chip.icon}
                                    <p className="text-xs font-bold text-stone-700 dark:text-stone-300 group-hover:text-stone-900 dark:group-hover:text-stone-100 text-center leading-tight transition-colors">{chip.label}</p>
                                    <p className="text-[10px] text-stone-400 group-hover:text-[#C3A675] mt-1 transition-colors">{chip.sub}</p>
                                </div>
                            );

                            if (chip.isPriceGuide) {
                                return (
                                    <PriceGuideSheet key={idx}>
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
                            {format(OPEN_DAY_CONFIG.closeAt, 'MM월dd일')}까지 예약가능합니다.
                        </p>
                    </div>
                </section>

                {/* 3.5 Weekly Mission (Moved) */}
                <section className="px-4 mb-8">
                    <MissionHomeWidget />
                </section>

                {/* 4. Recommendations Grid (Dynamic) */}
                <RecommendationGrid onItemClick={handleRecommendationClick} />
            </main>

            {/* Slim Notice Layout Position */}
            <div className="absolute bottom-0 left-0 right-0 z-40">
                <SlimNotice />
            </div>

            {/* Global Detail Sheet */}
            <HomeDetailSheet
                isOpen={detailSheetOpen}
                onClose={() => setDetailSheetOpen(false)}
                data={detailData}
            />

            {/* Nearby LBS Sheet */}
            <NearbyDetailSheet
                isOpen={nearbySheetOpen}
                onClose={() => setNearbySheetOpen(false)}
                events={nearbyEvents}
                facilities={config?.nearby_places as any[] || []}
                userLocation={lbs.location}
                getDistance={lbs.getDistanceKm}
            />
        </div>
    );
}
