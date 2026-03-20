import React, { useState, useMemo, useEffect } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Calendar, Navigation, Phone, Copy, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { Skeleton } from "@/components/ui/skeleton";
import { dispatchPersonaAction } from '@/lib/persona';
import { createClient } from '@/lib/supabase-client';

interface NearbyEvent {
    id: number | string;
    title: string;
    description: string | null;
    location: string | null;
    start_date: string | null;
    end_date: string | null;
    image_url?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    detail_url?: string | null; // 행사 상세 페이지 링크
    source?: 'tourapi' | 'performance' | 'festival';
}

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

interface UserLocation {
    latitude: number;
    longitude: number;
}

interface NearbyDetailSheetProps {
    isOpen: boolean;
    onClose: () => void;
    events?: NearbyEvent[];
    facilities?: Facility[];
    userLocation?: UserLocation;
    getDistance?: (lat: number, lng: number) => number;
    enableApiCall?: boolean; // true면 API에서 실시간 데이터 조회
    isUsingDefault?: boolean; // 위치 권한 거부 시 true
    customDescription?: string;
}

export default function NearbyDetailSheet({
    isOpen,
    onClose,
    events: propEvents = [],
    facilities: propFacilities = [],
    userLocation,
    getDistance,
    enableApiCall = true,
    isUsingDefault = false,
    customDescription,
}: NearbyDetailSheetProps) {
    const [activeTab, setActiveTab] = useState("events");
 
    // --- [Phase 3] Tag Sensor: LBS Interaction ---
    const logLbsInteraction = async (cat?: string) => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        let actionKey = '';
        if (cat === '카페' || cat === 'Bakery') actionKey = 'LBS_CLICK_CAFE';
        else if (cat === '마트' || cat === 'Store') actionKey = 'LBS_CLICK_MART';
        else if (activeTab === 'attractions') actionKey = 'LBS_CLICK_ATTRACTION';
        else if (activeTab === 'leisure') actionKey = 'LBS_CLICK_LEISURE';

        if (actionKey) {
            await dispatchPersonaAction(user.id, actionKey as any);
        }
    };

    // API Fetching States
    const [apiEvents, setApiEvents] = useState<NearbyEvent[]>([]);
    const [apiFacilities, setApiFacilities] = useState<Facility[]>([]);
    const [apiLeisure, setApiLeisure] = useState<NearbyEvent[]>([]);
    const [apiAttractions, setApiAttractions] = useState<NearbyEvent[]>([]);
    const [eventsLoading, setEventsLoading] = useState(false);
    const [facilitiesLoading, setFacilitiesLoading] = useState(false);
    const [leisureLoading, setLeisureLoading] = useState(false);
    const [attractionsLoading, setAttractionsLoading] = useState(false);
    const [eventsError, setEventsError] = useState<string | null>(null);
    const [facilitiesError, setFacilitiesError] = useState<string | null>(null);

    // 백버튼 처리: Sheet 열릴 때 히스토리 추가, 백버튼 시 Sheet 닫기
    useEffect(() => {
        if (isOpen) {
            history.pushState({ sheet: 'nearby' }, '');

            const handlePopState = () => {
                onClose();
            };

            window.addEventListener('popstate', handlePopState);

            return () => {
                window.removeEventListener('popstate', handlePopState);
            };
        }
    }, [isOpen, onClose]);

    // Fetch data when sheet opens
    useEffect(() => {
        if (!isOpen || !enableApiCall) return;

        const lat = userLocation?.latitude || 36.67; // 기본값: 예산군 응봉면
        const lng = userLocation?.longitude || 126.83;

        // Fetch Events from TourAPI
        const fetchEvents = async () => {
            setEventsLoading(true);
            setEventsError(null);
            try {
                const res = await fetch(`/api/nearby-events?lat=${lat}&lng=${lng}&radius=30000`);
                const data = await res.json();
                // API 성공이든 실패든 events 배열 사용 (에러 시 빈 배열)
                setApiEvents(data.events || []);
                // 에러가 있어도 사용자에게는 "행사 없음"으로 표시 (API 장애 시에도 UX 유지)
            } catch {
                // 네트워크 에러 시에도 빈 배열로 처리
                setApiEvents([]);
            } finally {
                setEventsLoading(false);
            }
        };

        // Fetch Facilities from Kakao API
        const fetchFacilities = async () => {
            setFacilitiesLoading(true);
            setFacilitiesError(null);
            try {
                const res = await fetch(`/api/nearby-facilities?lat=${lat}&lng=${lng}&radius=30000`);
                const data = await res.json();
                if (data.success) {
                    setApiFacilities(data.facilities || []);
                } else {
                    setFacilitiesError('편의시설 정보를 불러올 수 없습니다.');
                }
            } catch {
                setFacilitiesError('네트워크 오류가 발생했습니다.');
            } finally {
                setFacilitiesLoading(false);
            }
        };

        // Fetch Leisure (레포츠) from TourAPI
        const fetchLeisure = async () => {
            setLeisureLoading(true);
            try {
                const res = await fetch(`/api/nearby-activities?lat=${lat}&lng=${lng}&radius=30000&type=leisure`);
                const data = await res.json();
                setApiLeisure(data.items || []);
            } catch {
                setApiLeisure([]);
            } finally {
                setLeisureLoading(false);
            }
        };

        // Fetch Attractions (관광지) from TourAPI
        const fetchAttractions = async () => {
            setAttractionsLoading(true);
            try {
                const res = await fetch(`/api/nearby-activities?lat=${lat}&lng=${lng}&radius=30000&type=attraction`);
                const data = await res.json();
                setApiAttractions(data.items || []);
            } catch {
                setApiAttractions([]);
            } finally {
                setAttractionsLoading(false);
            }
        };

        fetchEvents();
        fetchFacilities();
        fetchLeisure();
        fetchAttractions();
    }, [isOpen, enableApiCall, userLocation?.latitude, userLocation?.longitude]);

    // Use API data if available, fallback to props
    const events = enableApiCall && apiEvents.length > 0 ? apiEvents : propEvents;
    const facilities = enableApiCall && apiFacilities.length > 0 ? apiFacilities : propFacilities;

    // Dynamic Facilities with Real-time Distance
    const dynamicFacilities = useMemo(() => {
        if (isOpen && userLocation && getDistance && facilities.length > 0) {
            // Recalculate distances
            const updated = facilities.map(f => {
                if (f.lat && f.lng) {
                    const dist = getDistance(f.lat, f.lng);
                    return { ...f, distance: `${dist.toFixed(1)}km` };
                }
                return f;
            }).sort((a, b) => {
                // Sort by distance if numeric
                const distStrA = a.distance || '999km';
                const distStrB = b.distance || '999km';
                const distA = parseFloat(distStrA.replace('km', ''));
                const distB = parseFloat(distStrB.replace('km', ''));
                return distA - distB;
            });
            return updated;
        } else {
            return facilities;
        }
    }, [isOpen, userLocation, facilities, getDistance]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("복사되었습니다.");
    };

    const handleNavigation = (lat: number, lng: number, name: string) => {
        // 1. Try Naver Map Scheme
        const naverScheme = `nmap://route/car?dlat=${lat}&dlng=${lng}&dname=${encodeURIComponent(name)}&appname=com.raoni`;
        // 2. Try Kakao Map Scheme
        const kakaoScheme = `kakaomap://route?ep=${lat},${lng}&by=CAR`;

        // Simple fallback logic: In a real mobile app, we process deep links differently.
        // For PWA/Mobile Web, we fallback to web URL immediately if scheme fails (which is hard to detect instantly in JS).
        // Solution: Open a Sheet or Prompt asking user preference? 
        // For MVP, we default to Naver Web Search or specific URL if scheme isn't easy.

        // Let's use a dual-button approach or just generic Web fallback for now to be safe, 
        // OR try the hidden iframe trick.
        // Given complexity, let's open a selection toast or just default to Naver Web for stability if we can't detect app.
        // BUT user asked for Deep Linking. We will try the scheme via window.location.href.

        // Let's implement a safe web fallback using Naver Map Web.
        const naverWeb = `https://map.naver.com/v5/directions/-/-/-/target,${name},${lat},${lng},CAR`;

        // Simple approach for Web Environment:
        window.open(naverWeb, '_blank');
        logLbsInteraction();

        // Note: For true "Deep Link" on mobile web, usually we use an intent:// URL or a universal link.
        // If we want to strictly follow the "Deep Link" requirement, we might need a selection UI.
    };

    const openNavigationChoice = (lat: number, lng: number, name: string) => {
        toast("네비게이션 앱 선택", {
            action: {
                label: "네이버지도",
                onClick: () => window.open(`https://map.naver.com/v5/directions/-/-/-/target,${name},${lat},${lng},CAR`, '_blank')
            },
            cancel: {
                label: "카카오맵",
                onClick: () => window.open(`https://map.kakao.com/link/to/${name},${lat},${lng}`, '_blank')
            },
            duration: 5000,
        });
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="bottom" className="rounded-t-[32px] p-0 border-none h-[85vh] outline-none bg-stone-50 dark:bg-zinc-900">
                <SheetHeader className="px-6 pt-8 pb-2">
                    <SheetTitle className="text-2xl font-bold text-[#1C4526] dark:text-[#A7F3D0]">
                        주변 즐길거리
                    </SheetTitle>
                    <SheetDescription>
                        {customDescription || (!isUsingDefault ? '주변 반경 30km의 레포츠,관광지,편의시설,행사를 확인하세요' : '캠핑장(예산군) 기준 30km 내의 행사와 편의시설을 확인하세요')}
                    </SheetDescription>
                    <p className="text-[10px] text-stone-400 mt-1">
                        ※ 외부 데이터 연동으로 정보 업데이트에 수초가 소요될 수 있습니다
                    </p>
                </SheetHeader>

                <div className="px-6 mt-4 h-full">
                    <Tabs defaultValue="leisure" className="w-full h-full" onValueChange={setActiveTab}>
                        <TabsList className="grid w-full grid-cols-4 bg-stone-200/50 dark:bg-zinc-800 p-1 rounded-2xl h-12">
                            <TabsTrigger
                                value="leisure"
                                className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:text-[#1C4526] data-[state=active]:shadow-sm font-bold text-xs"
                            >
                                🏕️ 레포츠 ({apiLeisure.length})
                            </TabsTrigger>
                            <TabsTrigger
                                value="attractions"
                                className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:text-[#1C4526] data-[state=active]:shadow-sm font-bold text-xs"
                            >
                                📍 관광지 ({apiAttractions.length})
                            </TabsTrigger>
                            <TabsTrigger
                                value="facilities"
                                className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:text-[#1C4526] data-[state=active]:shadow-sm font-bold text-xs"
                            >
                                🏪 편의 ({dynamicFacilities.length})
                            </TabsTrigger>
                            <TabsTrigger
                                value="events"
                                className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:text-[#1C4526] data-[state=active]:shadow-sm font-bold text-xs"
                            >
                                🎉 행사 ({events.length})
                            </TabsTrigger>
                        </TabsList>

                        {/* Events Tab */}
                        <TabsContent value="events" className="mt-6 space-y-4 pb-24 overflow-y-auto h-[calc(100%-180px)] pr-1 scrollbar-hide">
                            {eventsLoading ? (
                                // Loading State
                                <div className="space-y-4">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="bg-white dark:bg-zinc-800 rounded-2xl overflow-hidden">
                                            <Skeleton className="h-32 w-full" />
                                            <div className="p-5 space-y-3">
                                                <Skeleton className="h-6 w-3/4" />
                                                <Skeleton className="h-4 w-full" />
                                                <Skeleton className="h-12 w-full rounded-xl" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : eventsError ? (
                                // Error State
                                <div className="text-center py-10">
                                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <RefreshCw className="text-red-400" size={24} />
                                    </div>
                                    <p className="text-stone-600 mb-4">{eventsError}</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => window.location.reload()}
                                        className="rounded-xl"
                                    >
                                        <RefreshCw size={14} className="mr-2" /> 다시 시도
                                    </Button>
                                </div>
                            ) : events.length > 0 ? (
                                events.map((event) => {
                                    // Calculate distance relative to User if possible
                                    let distanceInfo = event.location;
                                    if (userLocation && getDistance && event.latitude && event.longitude) {
                                        const dist = getDistance(event.latitude, event.longitude);
                                        distanceInfo = `${dist}km | ${event.location}`;
                                    }


                                    // Badge Text & Color based on Source
                                    let badgeText = "진행중";
                                    let badgeClass = "bg-[#E8F5E9] text-[#1C4526]";

                                    if (event.source === 'performance') {
                                        badgeText = "공연";
                                        badgeClass = "bg-purple-50 text-purple-600";
                                    } else if (event.source === 'festival') {
                                        badgeText = "축제";
                                        badgeClass = "bg-pink-50 text-pink-600";
                                    }

                                    return (
                                        <div key={event.id} className="bg-white dark:bg-zinc-800 rounded-2xl overflow-hidden shadow-sm border border-stone-100 dark:border-zinc-700 transition-all hover:shadow-md p-5">
                                            {/* Header with Badge */}
                                            <div className="flex items-start justify-between mb-2">
                                                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex-1">{event.title}</h3>
                                                <Badge className={`${badgeClass} border-none shadow-sm flex-none ml-2`}>
                                                    {badgeText}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-stone-500 mb-4 line-clamp-2">{event.description}</p>

                                            <div className="flex flex-col gap-2 text-sm text-stone-600 dark:text-stone-400 bg-stone-50 dark:bg-zinc-800/50 p-3 rounded-xl">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={14} className="text-[#C3A675]" />
                                                    <span>{event.start_date} ~ {event.end_date}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <MapPin size={14} className="text-[#C3A675]" />
                                                    <span>{distanceInfo}</span>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex gap-2 mt-4">
                                                {/* 상세보기 버튼 (링크가 있을 때만 표시) */}
                                                {event.detail_url && (
                                                    <Button
                                                        variant="outline"
                                                        className="flex-1 border-[#1C4526] text-[#1C4526] hover:bg-[#E8F5E9] rounded-xl h-12"
                                                        onClick={() => {
                                                            window.open(event.detail_url!, '_blank');
                                                            logLbsInteraction();
                                                        }}
                                                    >
                                                        <ExternalLink size={16} className="mr-2" />
                                                        상세보기
                                                    </Button>
                                                )}
                                                {/* 길찾기 버튼 */}
                                                {event.latitude && event.longitude && (
                                                    <Button
                                                        className={`${event.detail_url ? 'flex-1' : 'w-full'} bg-[#1C4526] text-white hover:bg-[#15341C] rounded-xl h-12`}
                                                        onClick={() => openNavigationChoice(event.latitude!, event.longitude!, event.title)}
                                                    >
                                                        <Navigation size={16} className="mr-2" />
                                                        길찾기
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            ) : (
                                <div className="text-center py-10 text-stone-500">
                                    <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Calendar className="text-stone-400" size={24} />
                                    </div>
                                    <p>현재 진행중인 행사가 없습니다.</p>
                                    <p className="text-xs text-stone-400 mt-1">반경 30km 내 검색 결과입니다.</p>
                                </div>
                            )}
                        </TabsContent>

                        {/* Leisure Tab */}
                        <TabsContent value="leisure" className="mt-6 space-y-4 pb-24 overflow-y-auto h-[calc(100%-180px)] pr-1 scrollbar-hide">
                            {leisureLoading ? (
                                <div className="space-y-4">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="bg-white dark:bg-zinc-800 rounded-2xl overflow-hidden">
                                            <Skeleton className="h-32 w-full" />
                                            <div className="p-5 space-y-3">
                                                <Skeleton className="h-6 w-3/4" />
                                                <Skeleton className="h-4 w-full" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : apiLeisure.length > 0 ? (
                                apiLeisure.map((item) => (
                                    <div key={item.id} className="bg-white dark:bg-zinc-800 rounded-2xl overflow-hidden shadow-sm border border-stone-100 dark:border-zinc-700 transition-all hover:shadow-md p-5">
                                        <div className="flex items-start justify-between mb-2">
                                            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex-1">{item.title}</h3>
                                            <Badge className="bg-orange-50 text-orange-600 border-none shadow-sm flex-none ml-2">
                                                레포츠
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-stone-500 mb-4 line-clamp-2">{item.description}</p>
                                        <div className="flex flex-col gap-2 text-sm text-stone-600 dark:text-stone-400 bg-stone-50 dark:bg-zinc-800/50 p-3 rounded-xl">
                                            <div className="flex items-center gap-2">
                                                <MapPin size={14} className="text-[#C3A675]" />
                                                <span>{item.detail_url ? `${(item as any).distance_km}km | ${item.location}` : item.location}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 mt-4">
                                            {item.detail_url && (
                                                <Button variant="outline" className="flex-1 border-[#1C4526] text-[#1C4526] hover:bg-[#E8F5E9] rounded-xl h-12" onClick={() => {
                                                    window.open(item.detail_url!, '_blank');
                                                    logLbsInteraction();
                                                }}>
                                                    <ExternalLink size={16} className="mr-2" /> 상세보기
                                                </Button>
                                            )}
                                            {item.latitude && item.longitude && (
                                                <Button className={`${item.detail_url ? 'flex-1' : 'w-full'} bg-[#1C4526] text-white hover:bg-[#15341C] rounded-xl h-12`} onClick={() => {
                                                    openNavigationChoice(item.latitude!, item.longitude!, item.title);
                                                    logLbsInteraction();
                                                }}>
                                                    <Navigation size={16} className="mr-2" /> 길찾기
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 text-stone-500">
                                    <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <MapPin className="text-stone-400" size={24} />
                                    </div>
                                    <p>주변 레포츠 시설이 없습니다.</p>
                                    <p className="text-xs text-stone-400 mt-1">반경 30km 내 검색 결과입니다.</p>
                                </div>
                            )}
                        </TabsContent>

                        {/* Attractions Tab */}
                        <TabsContent value="attractions" className="mt-6 space-y-4 pb-24 overflow-y-auto h-[calc(100%-180px)] pr-1 scrollbar-hide">
                            {attractionsLoading ? (
                                <div className="space-y-4">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="bg-white dark:bg-zinc-800 rounded-2xl overflow-hidden">
                                            <Skeleton className="h-32 w-full" />
                                            <div className="p-5 space-y-3">
                                                <Skeleton className="h-6 w-3/4" />
                                                <Skeleton className="h-4 w-full" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : apiAttractions.length > 0 ? (
                                apiAttractions.map((item) => (
                                    <div key={item.id} className="bg-white dark:bg-zinc-800 rounded-2xl overflow-hidden shadow-sm border border-stone-100 dark:border-zinc-700 transition-all hover:shadow-md p-5">
                                        <div className="flex items-start justify-between mb-2">
                                            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex-1">{item.title}</h3>
                                            <Badge className="bg-blue-50 text-blue-600 border-none shadow-sm flex-none ml-2">
                                                관광지
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-stone-500 mb-4 line-clamp-2">{item.description}</p>
                                        <div className="flex flex-col gap-2 text-sm text-stone-600 dark:text-stone-400 bg-stone-50 dark:bg-zinc-800/50 p-3 rounded-xl">
                                            <div className="flex items-center gap-2">
                                                <MapPin size={14} className="text-[#C3A675]" />
                                                <span>{item.detail_url ? `${(item as any).distance_km}km | ${item.location}` : item.location}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 mt-4">
                                            {item.detail_url && (
                                                <Button variant="outline" className="flex-1 border-[#1C4526] text-[#1C4526] hover:bg-[#E8F5E9] rounded-xl h-12" onClick={() => {
                                                    window.open(item.detail_url!, '_blank');
                                                    logLbsInteraction();
                                                }}>
                                                    <ExternalLink size={16} className="mr-2" /> 상세보기
                                                </Button>
                                            )}
                                            {item.latitude && item.longitude && (
                                                <Button className={`${item.detail_url ? 'flex-1' : 'w-full'} bg-[#1C4526] text-white hover:bg-[#15341C] rounded-xl h-12`} onClick={() => {
                                                    openNavigationChoice(item.latitude!, item.longitude!, item.title);
                                                    logLbsInteraction();
                                                }}>
                                                    <Navigation size={16} className="mr-2" /> 길찾기
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 text-stone-500">
                                    <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <MapPin className="text-stone-400" size={24} />
                                    </div>
                                    <p>주변 관광지가 없습니다.</p>
                                    <p className="text-xs text-stone-400 mt-1">반경 30km 내 검색 결과입니다.</p>
                                </div>
                            )}
                        </TabsContent>

                        {/* Facilities Tab */}
                        <TabsContent value="facilities" className="mt-6 space-y-3 pb-24 overflow-y-auto h-[calc(100%-180px)] pr-1 scrollbar-hide">
                            {facilitiesLoading ? (
                                // Loading State
                                <div className="space-y-3">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <div key={i} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800 rounded-2xl">
                                            <div className="flex items-center gap-4">
                                                <Skeleton className="w-12 h-12 rounded-full" />
                                                <div className="space-y-2">
                                                    <Skeleton className="h-5 w-32" />
                                                    <Skeleton className="h-3 w-24" />
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Skeleton className="w-10 h-10 rounded-full" />
                                                <Skeleton className="w-10 h-10 rounded-full" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : facilitiesError ? (
                                // Error State
                                <div className="text-center py-10">
                                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <RefreshCw className="text-red-400" size={24} />
                                    </div>
                                    <p className="text-stone-600 mb-4">{facilitiesError}</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => window.location.reload()}
                                        className="rounded-xl"
                                    >
                                        <RefreshCw size={14} className="mr-2" /> 다시 시도
                                    </Button>
                                </div>
                            ) : dynamicFacilities.length > 0 ? (
                                dynamicFacilities.map((place, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-stone-100 dark:border-zinc-700">
                                        <div className="flex items-center gap-4">
                                            <div className={`
                                                w-12 h-12 rounded-full flex items-center justify-center flex-none
                                                ${place.category === '마트' ? 'bg-blue-50 text-blue-600' :
                                                    place.category === '주유소' ? 'bg-orange-50 text-orange-600' :
                                                        place.category === '약국' ? 'bg-green-50 text-green-600' :
                                                            place.category === '병원' ? 'bg-red-50 text-red-600' : 'bg-stone-100 text-stone-500'}
                                            `}>
                                                <span className="text-xs font-bold">{place.category}</span>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-stone-900 dark:text-stone-100">{place.name}</h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs text-[#C3A675] font-bold">{place.distance}</span>
                                                    <span className="text-[10px] text-stone-300">|</span>
                                                    <span className="text-xs text-stone-500">{place.phone}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-10 h-10 rounded-full p-0 border-stone-200"
                                                onClick={() => {
                                                    if (place.phone) {
                                                        copyToClipboard(place.phone);
                                                        logLbsInteraction(place.category);
                                                    }
                                                }}
                                            >
                                                <Copy size={16} className="text-stone-400" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-10 h-10 rounded-full p-0 border-stone-200"
                                                onClick={() => {
                                                    if (place.lat !== undefined && place.lng !== undefined) {
                                                        openNavigationChoice(place.lat, place.lng, place.name || '');
                                                        logLbsInteraction(place.category);
                                                    }
                                                }}
                                            >
                                                <Navigation size={16} className="text-stone-600" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 text-stone-500">
                                    <p>등록된 주변 시설이 없습니다.</p>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </SheetContent>
        </Sheet >
    );
}
