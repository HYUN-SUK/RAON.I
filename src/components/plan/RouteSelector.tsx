'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, Navigation, Check, ChevronRight, ChevronLeft, Info, AlertCircle, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Map, MapMarker, Polyline, useKakaoLoader } from 'react-kakao-maps-sdk';

interface RouteSelectorProps {
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
    destinationName?: string;
    onSelect: (midpoint: { lat: number; lng: number }, routeData: any) => void;
}

const ROUTE_LABELS = [
    { label: '추천 경로 1', keyword: 'Best 추천', color: '#224732', bg: 'bg-[#224732]/10' },
    { label: '추천 경로 2', keyword: '대안 경로', color: '#3B82F6', bg: 'bg-blue-50' },
    { label: '추천 경로 3', keyword: '여유 경로', color: '#10B981', bg: 'bg-emerald-50' }
];

export default function RouteSelector({ origin, destination, destinationName, onSelect }: RouteSelectorProps) {
    const [loading, error] = useKakaoLoader({
        appkey: process.env.NEXT_PUBLIC_KAKAO_JS_KEY!,
        libraries: ['services', 'clusterer'],
    });

    const [routes, setRoutes] = useState<any[]>([]);
    const [refinedDestination, setRefinedDestination] = useState<any>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isFetchingRoutes, setIsFetchingRoutes] = useState(true);
    const [map, setMap] = useState<any>(null);

    // 1. Fetch Routes (Single call with alternatives=true)
    useEffect(() => {
        async function fetchRoutes() {
            setIsFetchingRoutes(true);
            try {
                const res = await fetch('/api/routes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ origin, destination, destinationName })
                });
                const data = await res.json();
                if (data.routes && data.routes.length > 0) {
                    setRoutes(data.routes);
                    setRefinedDestination(data.refinedDestination || null);
                    setSelectedIndex(0);
                } else {
                    toast.error('이용 가능한 경로 정보가 없습니다.');
                }
            } catch (err) {
                toast.error('경로 정보를 불러오는데 실패했습니다.');
            } finally {
                setIsFetchingRoutes(false);
            }
        }
        fetchRoutes();
    }, [origin, destination, destinationName]);

    // Target Destination Coords for Rendering (Refined or Original)
    const targetDestCoords = useMemo(() => {
        if (refinedDestination && refinedDestination.isRefined) {
            return { lat: refinedDestination.lat, lng: refinedDestination.lng };
        }
        return destination;
    }, [destination, refinedDestination]);

    // 2. Format Polyline Paths
    const routePaths = useMemo(() => {
        return routes.map(route => {
            const path: { lat: number, lng: number }[] = [];
            if (route && route.sections && route.sections[0] && Array.isArray(route.sections[0].roads)) {
                route.sections[0].roads.forEach((road: any) => {
                    if (road && Array.isArray(road.vertexes)) {
                        for (let i = 0; i < road.vertexes.length; i += 2) {
                            path.push({ lat: road.vertexes[i + 1], lng: road.vertexes[i] });
                        }
                    }
                });
            }
            return path;
        });
    }, [routes]);

    // 3. Map Bounds Calculation
    const bounds = useMemo(() => {
        if (typeof window === 'undefined' || !window.kakao || routes.length === 0) return null;
        const b = new window.kakao.maps.LatLngBounds();
        b.extend(new window.kakao.maps.LatLng(origin.lat, origin.lng));
        b.extend(new window.kakao.maps.LatLng(targetDestCoords.lat, targetDestCoords.lng));
        
        if (routePaths[selectedIndex]) {
            routePaths[selectedIndex].forEach(p => b.extend(new window.kakao.maps.LatLng(p.lat, p.lng)));
        }
        return b;
    }, [origin, targetDestCoords, routePaths, selectedIndex]);

    // 4. Update Map Bounds Automatically
    useEffect(() => {
        if (map && bounds) {
            map.setBounds(bounds);
        }
    }, [map, bounds]);

    const handleConfirm = () => {
        if (!routes[selectedIndex]) return;
        
        const section = routes[selectedIndex]?.sections?.[0];
        let midpoint = { lat: origin.lat, lng: origin.lng };

        if (section && Array.isArray(section.roads)) {
            const targetDuration = (section.duration || 0) / 2;
            let accumulated = 0;

            for (const road of section.roads) {
                accumulated += (road.duration || 0);
                if (accumulated >= targetDuration && Array.isArray(road.vertexes) && road.vertexes.length >= 2) {
                    midpoint = { lat: road.vertexes[1], lng: road.vertexes[0] };
                    break;
                }
            }
        }
        onSelect(midpoint, routes[selectedIndex]);
    };

    if (loading || isFetchingRoutes) {
        return (
            <div className="w-full h-[500px] flex flex-col items-center justify-center space-y-5 bg-white rounded-3xl border border-dashed border-[#224732]/20">
                <div className="relative">
                    <div className="w-12 h-12 border-4 border-[#224732]/10 rounded-full" />
                    <div className="absolute top-0 left-0 w-12 h-12 border-4 border-[#224732] border-t-transparent rounded-full animate-spin" />
                </div>
                <div className="text-center px-6">
                    <p className="text-sm font-bold text-[#224732]">최적의 여행 경로를 탐색 중입니다</p>
                    <p className="text-[11px] text-gray-400 mt-1">카카오 추천 경로와 대안을 분석하고 있어요.</p>
                </div>
            </div>
        );
    }

    if (error || (routes.length === 0 && !isFetchingRoutes)) {
        return (
            <div className="w-full h-[400px] flex flex-col items-center justify-center p-8 text-center bg-red-50 rounded-3xl">
                <Info className="w-12 h-12 text-red-400 mb-4" />
                <p className="text-sm font-bold text-red-900">경로 정보를 가져올 수 없습니다</p>
                <Button onClick={() => window.location.reload()} variant="outline" className="mt-4 border-red-200">다시 시도</Button>
            </div>
        );
    }

    const currentRoute = routes[selectedIndex] || {};
    const currentSummary = currentRoute.summary || {};
    const currentFare = currentSummary.fare || {};
    const currentLabel = ROUTE_LABELS[selectedIndex] || ROUTE_LABELS[0];

    const tollPrice = typeof currentFare.toll === 'number' ? currentFare.toll : 0;
    const taxiPrice = typeof currentFare.taxi === 'number' ? currentFare.taxi : 0;
    const durationMinutes = Math.floor((currentSummary.duration || 0) / 60);
    const distanceKm = ((currentSummary.distance || 0) / 1000).toFixed(1);

    return (
        <div className="flex flex-col bg-white rounded-3xl overflow-hidden shadow-xl border border-gray-100 animate-in fade-in duration-500">
            {/* Header */}
            <div className="p-4 bg-white/95 backdrop-blur-md border-b border-gray-50 flex flex-col gap-1">
                <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <Navigation className="w-5 h-5 text-[#224732]" />
                    여행 여정 선택
                </h3>

                {/* 산악/등산로 목적지 인근 주차장 보정 안내 뱃지 */}
                {refinedDestination?.isRefined && (
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-800 text-xs mt-1 animate-fade-in">
                        <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                        <p className="leading-tight font-medium">
                            💡 산악 구역 인근 차도 <strong className="font-bold text-emerald-950">[{refinedDestination.name}]</strong> 기준 최적 통행료/경로입니다.
                        </p>
                    </div>
                )}
            </div>

            {/* Map Area */}
            <div className="relative w-full overflow-hidden bg-gray-100">
                <Map
                    center={{ lat: (origin.lat + targetDestCoords.lat) / 2, lng: (origin.lng + targetDestCoords.lng) / 2 }}
                    style={{ width: '100%', height: '350px' }}
                    onCreate={(m) => setMap(m)}
                >
                    <MapMarker position={origin} />
                    <MapMarker position={targetDestCoords} />
                    {routePaths[selectedIndex] && (
                        <Polyline
                            path={routePaths[selectedIndex]}
                            strokeWeight={7}
                            strokeColor={currentLabel.color}
                            strokeOpacity={1}
                            zIndex={10}
                        />
                    )}
                </Map>
            </div>

            {/* Route Detail Card */}
            <div className="p-4 bg-white">
                <div className="flex items-center justify-between mb-4">
                    <button 
                        onClick={() => setSelectedIndex(prev => (prev > 0 ? prev - 1 : routes.length - 1))}
                        disabled={routes.length <= 1}
                        className={`p-3 rounded-full transition-all ${routes.length <= 1 ? 'bg-gray-50 text-gray-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-90'}`}
                    >
                        <ChevronLeft size={24} />
                    </button>
                    
                    <div className="text-center flex-1">
                        <span className={`text-[10px] font-black px-3 py-1 rounded-full ${currentLabel.bg} text-[#224732] uppercase`}>
                            {currentLabel.keyword}
                        </span>
                        <div className="flex items-center gap-2 mt-1 justify-center">
                            <span className="text-2xl font-black text-gray-900">
                                {durationMinutes}<span className="text-sm ml-0.5">분</span>
                            </span>
                            <span className="text-gray-300">|</span>
                            <span className="text-sm font-bold text-gray-500">
                                {distanceKm}km
                            </span>
                        </div>
                    </div>

                    <button 
                        onClick={() => setSelectedIndex(prev => (prev < routes.length - 1 ? prev + 1 : 0))}
                        disabled={routes.length <= 1}
                        className={`p-3 rounded-full transition-all ${routes.length <= 1 ? 'bg-gray-50 text-gray-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-90'}`}
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>

                {/* Fare Info (Safe Optional Chaining Wrapped) */}
                <div className="bg-gray-50 rounded-2xl p-3 flex justify-around items-center border border-gray-100 mb-4">
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">통행료</span>
                        <span className="text-xs font-black text-gray-700">{tollPrice.toLocaleString()}원</span>
                    </div>
                    <div className="w-[1px] h-6 bg-gray-200" />
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">택시비</span>
                        <span className="text-xs font-black text-gray-700">{taxiPrice.toLocaleString()}원</span>
                    </div>
                </div>

                {/* Simple Route Alert */}
                {routes.length === 1 && (
                    <div className="flex items-center justify-center gap-1.5 mb-4 px-4 py-2 bg-red-50 rounded-xl border border-red-100">
                        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                        <p className="text-[11px] font-bold text-red-600">
                            단순한 경로이기에 추천 경로가 1개만 있습니다.
                        </p>
                    </div>
                )}

                {/* Progress Indicators */}
                {routes.length > 1 && (
                    <div className="flex justify-center gap-1.5 mb-6">
                        {routes.map((_, i) => (
                            <div 
                                key={i} 
                                className={`h-1.5 rounded-full transition-all duration-300 ${i === selectedIndex ? 'w-8 bg-[#224732]' : 'w-2 bg-gray-200'}`} 
                            />
                        ))}
                    </div>
                )}

                {/* Confirm Button */}
                <Button 
                    onClick={handleConfirm}
                    className={`w-full h-14 rounded-2xl bg-[#224732] hover:bg-[#1a3626] text-white font-black text-lg shadow-lg active:scale-95 transition-all ${routes.length === 1 ? 'mt-2' : ''}`}
                >
                    이 경로로 스마트플랜 생성
                </Button>
            </div>
        </div>
    );
}
