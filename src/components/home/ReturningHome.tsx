import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Tent, RefreshCcw } from 'lucide-react';
import TopBar from '@/components/TopBar';
import { useRouter } from 'next/navigation';
import { useReservationStore } from '@/store/useReservationStore';
import RecommendationGrid from '@/components/home/RecommendationGrid';
import SlimNotice from '@/components/home/SlimNotice';
import { OPEN_DAY_CONFIG } from '@/constants/reservation';
import { format } from 'date-fns';
import MissionHomeWidget from '@/components/home/MissionHomeWidget';
import HomeDetailSheet, { HomeDetailData } from '@/components/home/HomeDetailSheet';
import WeatherDetailSheet from '@/components/home/WeatherDetailSheet';
import NearbyDetailSheet from '@/components/home/NearbyDetailSheet';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { useLBS } from '@/hooks/useLBS';
import { usePersonalizedRecommendation } from '@/hooks/usePersonalizedRecommendation';
import { Database } from '@/types/supabase';
import NotificationBadge from '@/components/common/NotificationBadge';
import { usePushNotification } from '@/hooks/usePushNotification';
import PlanLockCard from '@/components/planlock/PlanLockCard';
import ScheduleHomeWidget from '@/components/schedule/ScheduleHomeWidget';
import { dispatchPersonaAction } from '@/lib/persona';
import { createClient } from '@/lib/supabase-client';



type NearbyEvent = Database['public']['Tables']['nearby_events']['Row'];
// Simplified facility interface based on usage
interface Facility {
    category?: string;
    name: string;
    title?: string;
    description?: string;
    distance?: string;
    phone?: string;
    lat?: number;
    lng?: number;
}

// UI recommendation item interface
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

export default function ReturningHome() {
    const router = useRouter();
    const { initRebook, lastReservation, fetchLastReservation, openDayRule, fetchOpenDayRule, fetchSites, reservations, fetchMyReservations } = useReservationStore();
    const { config } = useSiteConfig();
    const lbs = useLBS();

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

    const { data: recData, weather, loading: recLoading, shuffle } = usePersonalizedRecommendation(false);

    const { requestPermission } = usePushNotification();

    React.useEffect(() => {
        fetchSites();
        fetchOpenDayRule();
        fetchLastReservation();
        fetchMyReservations();
        // Auto-request permission on Home Load
        requestPermission();
    }, [fetchOpenDayRule, fetchLastReservation, fetchSites, requestPermission, fetchMyReservations]);

    // Bottom Sheet State
    const [detailSheetOpen, setDetailSheetOpen] = useState(false);
    const [weatherSheetOpen, setWeatherSheetOpen] = useState(false);
    const [detailData, setDetailData] = useState<HomeDetailData | null>(null);

    // Nearby LBS Sheet State
    const [nearbySheetOpen, setNearbySheetOpen] = useState(false);
    const [nearbyEvents, setNearbyEvents] = useState<NearbyEvent[]>([]);

    const handleRecommendationClick = (item: RecommendationItem, reason?: string) => {
        // --- [Phase 3] Curation Card Sensors (No 26-28) ---
        (async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                if (item.title?.includes('바다 앞')) {
                    await dispatchPersonaAction(user.id, 'LBS_CLICK_OCEAN_VIBE');
                } else if (item.title?.includes('깊은 산속')) {
                    await dispatchPersonaAction(user.id, 'LBS_CLICK_MOUNTAIN_VIBE');
                } else if (item.title?.includes('계곡 물놀이')) {
                    await dispatchPersonaAction(user.id, 'LBS_CLICK_VALLEY_VIBE');
                }
            }
        })();

        // Special Handling for LBS Card
        if (item.type === 'nearby_lbs') {
            setNearbyEvents(item.events || []);
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

        setDetailData({
            title: item.title,
            description: item.description || "이 활동은 라온아이에서 추천하는 특별한 경험입니다.",
            icon: <span className="text-4xl">{item.icon}</span>,
            actionLabel: item.actionLabel,
            actionLink: item.actionLink,
            bgColorClass: item.bgColorClass,
            // V2 Fields Copy
            categoryLabel: item.category === 'play' ? '오늘의 놀이' : '오늘의 셰프',
            ingredients: item.ingredients as string[] | { name: string; amount: string; }[] | undefined,
            steps: item.process_steps as string[] | undefined,
            tips: item.tips || undefined,
            time_required: item.time_required || undefined,
            difficulty: item.difficulty || undefined,

            // V2.1 Premium Fields
            image_url: item.image_url || undefined,
            servings: item.servings || undefined,
            calories: item.calories || undefined,
            age_group: item.age_group || undefined,
            location_type: item.location_type || undefined,

            // V9 Personalization
            reason: reason,
            category: item.category as 'cooking' | 'play'
        });
        setDetailSheetOpen(true);
    };
    return (
        <div className="flex flex-col w-full min-h-screen bg-[#F7F5EF] dark:bg-black relative">
            {/* Global TopBar */}
            <TopBar />

            <main className="flex-1 pb-24 overflow-y-auto scrollbar-hide">
                {/* 1. Personalized Hero Panel */}
                <section className="w-full bg-[#1C4526] text-white pt-16 pb-28 px-6 rounded-b-[40px] shadow-lg relative overflow-hidden">
                    {/* Background Image Overlay */}
                    <div className="absolute inset-0 z-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center" />

                    {/* Abstract Pattern */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                    <NotificationBadge variant="hero" />

                    <div className="relative z-10 mt-4 text-center flex flex-col items-center w-full">
                        {recData ? (
                            <>
                                <p className="text-white/90 text-lg leading-relaxed max-w-sm mx-auto">{recData.context ? recData.context.greeting : '반가워요, 김캠퍼님'}</p>
                                <div className="py-1 w-full">
                                    <div className="w-36 h-[2px] bg-white/30 mx-auto my-2.5" />
                                    <span className="tracking-[0.4em] font-bold text-white/95 text-[30px] text-center block pl-[0.4em]">라 온 아 이</span>
                                    <div className="w-36 h-[2px] bg-white/30 mx-auto my-2.5" />
                                </div>
                            </>
                        ) : (
                            <div className="space-y-3 animate-pulse">
                                <Skeleton className="h-6 w-20 bg-white/20 rounded-full" />
                                <Skeleton className="h-4 w-32 bg-white/20 rounded-md" />
                                <div className="space-y-2 pt-1">
                                    <Skeleton className="h-8 w-48 bg-white/20 rounded-lg" />
                                    <Skeleton className="h-8 w-40 bg-white/20 rounded-lg" />
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* 2. Floating Reservation / My Space Card */}
                <div className="px-4 -mt-12 relative z-20 mb-8">
                    <Card className="w-full bg-white dark:bg-zinc-900 border-none shadow-xl rounded-2xl overflow-hidden p-0">
                        <div className="p-5">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold text-stone-800 dark:text-stone-100">나의 예약</h2>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-stone-400 hover:text-stone-600 h-8 px-2"
                                    onClick={() => router.push('/myspace/reservations')}
                                >
                                    더보기 <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            </div>

                            {/* Zero-click Smart Re-booking (Roadmap v3) */}
                            {lastReservation ? (
                                <div className="mb-4 bg-[#F7F5EF] dark:bg-zinc-800 rounded-xl p-4 border border-[#1C4526]/10">
                                    <Button
                                        className="w-full bg-[#1C4526] hover:bg-[#224732] text-white h-10 text-xs font-semibold rounded-lg shadow-md transition-all active:scale-[0.96] duration-200"
                                        onClick={() => {
                                            initRebook(
                                                lastReservation.siteId,
                                                lastReservation.familyCount,
                                                lastReservation.visitorCount,
                                                lastReservation.vehicleCount,
                                                lastReservation.guestName,
                                                lastReservation.guestPhone
                                            );
                                            router.push('/reservation');
                                        }}
                                    >
                                        빠르게 재예약하기 (날짜 선택)
                                    </Button>
                                    <p className="text-center text-xs text-stone-400 mt-2">
                                        {format(openDayRule?.closeAt || OPEN_DAY_CONFIG.closeAt, 'MM월 dd일')}까지 예약 가능합니다.
                                    </p>
                                </div>
                            ) : (
                                <div className="mb-4 bg-[#F7F5EF] dark:bg-zinc-800 rounded-xl p-4 border border-[#1C4526]/10">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <Badge className="bg-[#1C4526] text-white hover:bg-[#1C4526] mb-1.5 px-2 py-0.5 text-[10px]">새 예약</Badge>
                                            <p className="font-bold text-stone-800 dark:text-stone-100 text-sm">새로운 예약 시작하기</p>
                                            <p className="text-xs text-stone-500 mt-0.5">원하는 날짜와 사이트를 선택해보세요.</p>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-stone-100 dark:bg-zinc-700 flex items-center justify-center">
                                            <Tent className="w-4 h-4 text-stone-500" />
                                        </div>
                                    </div>
                                    <Button
                                        className="w-full bg-[#1C4526] hover:bg-[#224732] text-white h-10 text-xs font-semibold rounded-lg shadow-md transition-all active:scale-[0.96] duration-200"
                                        onClick={() => router.push('/reservation')}
                                    >
                                        예약하러 가기
                                    </Button>
                                    <p className="text-center text-xs text-stone-400 mt-2">
                                        {format(openDayRule?.closeAt || OPEN_DAY_CONFIG.closeAt, 'MM월 dd일')}까지 예약 가능합니다.
                                    </p>
                                </div>
                            )}
                        </div>


                    </Card>
                </div>

                {/* 3.5 Schedule Widget (Moved to replace PlanLockCard) */}
                <div className="px-4 mb-4">
                    <ScheduleHomeWidget />
                </div>

                {/* 3. Mission Widget (Weekly) */}
                <div className="px-4 mb-4">
                    <MissionHomeWidget />
                </div>

                {/* 4. Recommendations Grid (Dynamic) */}
                {/* 4. Recommendations Grid (Dynamic) */}
                <RecommendationGrid
                    data={recData}
                    loading={recLoading}
                    onItemClick={handleRecommendationClick as any}
                />
            </main>

            {/* Slim Notice Layout Position */}
            <div className="absolute bottom-0 left-0 right-0 z-40">
                <SlimNotice />
            </div>

            <HomeDetailSheet
                isOpen={detailSheetOpen}
                onClose={() => setDetailSheetOpen(false)}
                data={detailData}
                onShuffle={shuffle}
            />

            {/* Weather Detail Sheet */}
            {weather && (
                <WeatherDetailSheet
                    isOpen={weatherSheetOpen}
                    onClose={() => setWeatherSheetOpen(false)}
                    weather={weather}
                />
            )}

            {/* Nearby LBS Sheet */}
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
                    detail_url: null,
                    source: 'tourapi'
                }))}
                facilities={config?.nearby_places as unknown as Facility[] || []}
                userLocation={lbs.location}
                getDistance={lbs.getDistanceKm}
                isUsingDefault={lbs.usingDefault}
            />
        </div>
    );
}
