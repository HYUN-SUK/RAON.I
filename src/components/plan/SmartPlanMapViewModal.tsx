'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Map, Polyline, CustomOverlayMap, useKakaoLoader } from 'react-kakao-maps-sdk';
import { X, MapPin, Phone, Check, List, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPlaceDetailText, getPlacePhoneNumber } from '@/utils/placeFormatter';
import { useModalBackHandler } from '@/hooks/useModalBackHandler';
import { cn } from '@/lib/utils';

interface SmartPlanMapViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** 'alternatives' (대체리스트 지도) | 'full_timeline' (전체 여행 동선 지도) */
    mode: 'alternatives' | 'full_timeline';
    /** 초기 생성 시 저장된 카카오내비 도로 경로 데이터 */
    selectedRouteData?: any;
    /** 출발지 좌표 */
    origin?: { lat: number; lng: number };
    /** 목적지 좌표 */
    destination?: { lat: number; lng: number };
    destinationName?: string;
    
    // [대체 리스트 모드 전용 Props]
    /** 현재 활성화된 장소 */
    currentActiveCard?: any;
    /** 대체 후보 장소 목록 (현재 장소 포함) */
    candidateCards?: any[];
    /** 후보 장소 선택 콜백 */
    onSelectCandidate?: (placeId: string) => void;
    /** 리스트로 보기로 전환 콜백 */
    onSwitchToList?: () => void;

    // [전체 동선 모드 전용 Props]
    /** 확정된 전체 방문 장소 목록 (숨김 장소는 이미 제외됨) */
    timelinePlaces?: any[];
    /** 커스텀 장소 카드 렌더러 (스마트플랜 본문의 정품 FactCard 렌더러) */
    renderCustomCard?: (card: any, onCloseCard: () => void) => React.ReactNode;

    // [v15.0.0 찜(Bookmark) 전용 Props]
    /** 찜(Bookmark)된 장소 ID 목록 (Set) */
    bookmarkedPlaceIds?: Set<string>;
    /** 찜 토글 콜백 */
    onToggleBookmark?: (placeId: string, card?: any, e?: React.MouseEvent) => void;
    /** [전체 동선 모드] 확정되지 않았으나 사용자가 찜해둔 후보 장소 목록 */
    bookmarkedCandidatePlaces?: any[];
}

export default function SmartPlanMapViewModal({
    isOpen,
    onClose,
    mode,
    selectedRouteData,
    origin,
    destination,
    destinationName = '목적지',
    currentActiveCard,
    candidateCards = [],
    onSelectCandidate,
    onSwitchToList,
    timelinePlaces = [],
    renderCustomCard,
    bookmarkedPlaceIds,
    onToggleBookmark,
    bookmarkedCandidatePlaces = []
}: SmartPlanMapViewModalProps) {
    // 1. 카카오맵 SDK 로더
    const [loading] = useKakaoLoader({
        appkey: process.env.NEXT_PUBLIC_KAKAO_JS_KEY!,
        libraries: ['services', 'clusterer'],
    });

    // 모바일 뒤로가기 제어
    useModalBackHandler(isOpen, onClose, 'smartPlanMapModal');

    // 맵 인스턴스
    const [map, setMap] = useState<any>(null);

    // [DOM Keep-Alive 싱글톤] 최초 1회 열림 추적 가드 (미사용 시 0원, 열림 시 최초 1회만 카카오 지도 생성)
    const [hasBeenOpened, setHasBeenOpened] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setHasBeenOpened(true);
        }
    }, [isOpen]);

    // 현재 지도에서 마커 터치로 포커스된 단일 장소 ID (없으면 하단 카드 숨김)
    const [focusedCardId, setFocusedCardId] = useState<string | null>(null);

    // 모달 진입 시 초기화: 전체동선 모드는 지도를 시원하게 보게끔 초기 포커스 없음(null)
    useEffect(() => {
        if (isOpen) {
            if (mode === 'alternatives') {
                setFocusedCardId(currentActiveCard?.id || candidateCards[0]?.id || null);
            } else {
                setFocusedCardId(null); // 전체 동선 모드는 카드가 닫힌 상태로 전체 지도 100% 시작
            }
        } else {
            setFocusedCardId(null);
        }
    }, [isOpen, mode, currentActiveCard, candidateCards]);

    // 2. 도로 주행 궤적선 (Polyline) 파싱 (출발지 -> 목적지 실제 카카오내비 도로망만 단독 유지)
    const baseRoutePath = useMemo(() => {
        if (!selectedRouteData) return [];
        const path: { lat: number; lng: number }[] = [];
        const section = selectedRouteData?.sections?.[0];
        if (section && Array.isArray(section.roads)) {
            section.roads.forEach((road: any) => {
                if (road && Array.isArray(road.vertexes)) {
                    for (let i = 0; i < road.vertexes.length; i += 2) {
                        path.push({ lat: road.vertexes[i + 1], lng: road.vertexes[i] });
                    }
                }
            });
        }
        return path;
    }, [selectedRouteData]);

    // 3. 카카오 LatLngBounds 자동 화면 피팅 함수 (useCallback으로 재사용 보장)
    const fitBounds = useCallback(() => {
        if (!map || !window.kakao || !window.kakao.maps || !window.kakao.maps.LatLngBounds) return;

        try {
            const bounds = new window.kakao.maps.LatLngBounds();
            let pointCount = 0;

            if (origin && origin.lat && origin.lng) {
                bounds.extend(new window.kakao.maps.LatLng(origin.lat, origin.lng));
                pointCount++;
            }
            if (destination && destination.lat && destination.lng) {
                bounds.extend(new window.kakao.maps.LatLng(destination.lat, destination.lng));
                pointCount++;
            }

            if (mode === 'alternatives') {
                candidateCards.forEach(c => {
                    if (c.lat && c.lng && c.lat > 33 && c.lat < 39) {
                        bounds.extend(new window.kakao.maps.LatLng(c.lat, c.lng));
                        pointCount++;
                    }
                });
                if (baseRoutePath.length > 0) {
                    baseRoutePath.forEach((p, idx) => {
                        if (idx % 20 === 0) {
                            bounds.extend(new window.kakao.maps.LatLng(p.lat, p.lng));
                        }
                    });
                }
            } else if (mode === 'full_timeline') {
                timelinePlaces.forEach(p => {
                    if (p.lat && p.lng && p.lat > 33 && p.lat < 39) {
                        bounds.extend(new window.kakao.maps.LatLng(p.lat, p.lng));
                        pointCount++;
                    }
                });
                if (bookmarkedCandidatePlaces && bookmarkedCandidatePlaces.length > 0) {
                    bookmarkedCandidatePlaces.forEach(c => {
                        if (c.lat && c.lng && c.lat > 33 && c.lat < 39) {
                            bounds.extend(new window.kakao.maps.LatLng(c.lat, c.lng));
                            pointCount++;
                        }
                    });
                }
                if (baseRoutePath.length > 0) {
                    baseRoutePath.forEach((p, idx) => {
                        if (idx % 20 === 0) {
                            bounds.extend(new window.kakao.maps.LatLng(p.lat, p.lng));
                        }
                    });
                }
            }

            if (pointCount > 0) {
                map.setBounds(bounds);
            }
        } catch (e) {
            console.warn('[SmartPlanMapViewModal] LatLngBounds calculation failed:', e);
        }
    }, [map, mode, candidateCards, timelinePlaces, bookmarkedCandidatePlaces, baseRoutePath, origin, destination]);

    // 데이터 변경 시 바운드 동기화
    useEffect(() => {
        if (isOpen) {
            fitBounds();
        }
    }, [isOpen, fitBounds]);

    // [Keep-Alive 복원] 재오픈 시 DOM 크기 복원 후 0.001초 만에 map.relayout() 동기화 (추가 쿼터 소모 0건)
    useEffect(() => {
        if (isOpen && map) {
            const timer = setTimeout(() => {
                map.relayout();
                fitBounds();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [isOpen, map, fitBounds]);

    // 4. 포커스된 장소 정보 (대체리스트 모드 or 전체동선 모드 통합 지원)
    const focusedCard = useMemo(() => {
        if (!focusedCardId) return null;
        if (mode === 'alternatives') {
            return candidateCards.find(c => c.id === focusedCardId) || null;
        } else {
            return timelinePlaces.find(p => p.id === focusedCardId) || 
                   bookmarkedCandidatePlaces?.find(p => p.id === focusedCardId) || 
                   null;
        }
    }, [focusedCardId, mode, candidateCards, timelinePlaces, bookmarkedCandidatePlaces]);

    // 최초 오픈 이전에는 DOM 마운트 일체 방지 (0원 유지)
    if (!hasBeenOpened && !isOpen) return null;

    return (
        <div 
            className={cn(
                "fixed inset-0 z-[999] flex flex-col bg-black/70 backdrop-blur-sm transition-opacity duration-200",
                !isOpen && "hidden pointer-events-none"
            )}
        >
            {/* 상단 컨트롤 헤더 */}
            <div 
                className="bg-[#112419] text-white px-4 pb-3 flex items-center justify-between shrink-0 shadow-lg border-b border-white/10 z-10"
                style={{
                    paddingTop: 'calc(var(--sat, env(safe-area-inset-top, 0px)) + 12px)'
                }}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <h3 className="font-bold text-sm truncate">
                        {mode === 'alternatives' ? '🗺️ 경로 기반 추천 장소 위치 비교' : '🚗 나의 최종 여행 전체 동선'}
                    </h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {mode === 'alternatives' && onSwitchToList && (
                        <button
                            onClick={onSwitchToList}
                            className="px-2.5 py-1 text-xs font-bold text-emerald-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl border border-emerald-400/30 flex items-center gap-1 active:scale-95 transition-all"
                        >
                            <List className="w-3.5 h-3.5" />
                            <span>리스트로 보기</span>
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-300 hover:text-white rounded-full hover:bg-white/10 active:scale-95 transition-all"
                        aria-label="닫기"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* 메인 지도 영역 (화면 상단부 시원하게 확보) */}
            <div 
                id="smart-plan-kakao-map-wrapper"
                className="relative flex-1 w-full bg-gray-100 overflow-hidden"
                style={{ touchAction: 'none' }} // 모바일 지도 드래그 시 모달 스크롤 간섭 방지
            >
                {loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/90 z-20 space-y-3">
                        <div className="w-9 h-9 border-4 border-[#388E5A]/20 border-t-[#388E5A] rounded-full animate-spin" />
                        <p className="text-xs font-bold text-[#388E5A]">카카오 정밀 지도를 로딩 중입니다...</p>
                    </div>
                ) : (
                    <Map
                        center={destination || { lat: 37.5665, lng: 126.9780 }}
                        style={{ width: '100%', height: '100%' }}
                        level={7}
                        onCreate={setMap}
                    >
                        {/* 1. 배경 도로 주행 궤적선 (실제 카카오내비 도로망) */}
                        {baseRoutePath.length > 0 && (
                            <Polyline
                                path={baseRoutePath}
                                strokeWeight={6}
                                strokeColor="#388E5A"
                                strokeOpacity={0.7}
                                strokeStyle="solid"
                            />
                        )}

                        {/* 2. 출발지 마커 (xAnchor 0.5, yAnchor 1.0 정밀 고정) */}
                        {origin && origin.lat && origin.lng && (
                            <CustomOverlayMap position={origin} xAnchor={0.5} yAnchor={1.0}>
                                <div className="flex flex-col items-center">
                                    <div className="px-2 py-1 bg-blue-600 text-white text-[10px] font-black rounded-full shadow-md border border-white flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                        출발지
                                    </div>
                                    <div className="w-0 h-0 border-x-3 border-x-transparent border-t-4 border-t-blue-600 mx-auto" />
                                </div>
                            </CustomOverlayMap>
                        )}

                        {/* 3. 목적지 마커 (xAnchor 0.5, yAnchor 1.0 정밀 고정) */}
                        {destination && destination.lat && destination.lng && (
                            <CustomOverlayMap position={destination} xAnchor={0.5} yAnchor={1.0}>
                                <div className="flex flex-col items-center">
                                    <div className="px-2.5 py-1 bg-[#388E5A] text-white text-[11px] font-black rounded-full shadow-lg border-2 border-emerald-300 flex items-center gap-1">
                                        <span>🚩</span>
                                        <span>{destinationName}</span>
                                    </div>
                                    <div className="w-0 h-0 border-x-4 border-x-transparent border-t-6 border-t-[#388E5A] mx-auto" />
                                </div>
                            </CustomOverlayMap>
                        )}

                        {/* 4-A. [대체리스트 모드] 후보 장소 커스텀 말풍선 마커 렌더링 (4단 컬러) */}
                        {mode === 'alternatives' && candidateCards.map((cand, idx) => {
                            if (!cand.lat || !cand.lng) return null;
                            const isCurrentActive = cand.id === currentActiveCard?.id;
                            const isFocused = cand.id === focusedCardId;
                            const isBookmarked = bookmarkedPlaceIds?.has(cand.id) ?? false;
                            const isMerged = (isFocused || isCurrentActive) && isBookmarked;
                            const badge = cand.evidence?.displayBadges?.[0]?.emoji || '';
                            const rankNum = idx + 1;

                            // 꼬리 색상 및 배경/테두리 스타일 결정
                            let bubbleStyle = 'bg-white text-gray-900 border-gray-200';
                            let tailColor = '#ffffff';
                            let zIndexVal = 10;

                            if (isMerged) {
                                bubbleStyle = 'bg-gradient-to-r from-amber-500 via-rose-500 to-rose-600 text-white border-white ring-4 ring-rose-400/50 shadow-xl animate-pulse';
                                tailColor = '#e11d48';
                                zIndexVal = 50;
                            } else if (isFocused) {
                                bubbleStyle = 'bg-amber-500 text-white border-white ring-4 ring-amber-400/40 shadow-xl';
                                tailColor = '#f59e0b';
                                zIndexVal = 40;
                            } else if (isBookmarked) {
                                bubbleStyle = 'bg-rose-500 text-white border-white ring-4 ring-rose-300/40 shadow-lg';
                                tailColor = '#f43f5e';
                                zIndexVal = 35;
                            } else if (isCurrentActive) {
                                bubbleStyle = 'bg-[#388E5A] text-white border-emerald-300 shadow-md';
                                tailColor = '#388E5A';
                                zIndexVal = 30;
                            }

                            return (
                                <CustomOverlayMap
                                    key={cand.id}
                                    position={{ lat: cand.lat, lng: cand.lng }}
                                    xAnchor={0.5}
                                    yAnchor={1.0}
                                    zIndex={zIndexVal}
                                >
                                    <div
                                        onClick={() => {
                                            setFocusedCardId(prev => prev === cand.id ? null : cand.id);
                                        }}
                                        className={`cursor-pointer transition-transform active:scale-95 flex flex-col items-center ${
                                            isFocused || isMerged ? 'scale-110' : 'scale-100 hover:scale-105'
                                        }`}
                                    >
                                        <div className={`px-2.5 py-1 rounded-xl shadow-xl flex items-center gap-1.5 border-2 text-[11px] font-black whitespace-nowrap ${bubbleStyle}`}>
                                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${
                                                isMerged || isFocused || isBookmarked || isCurrentActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                                            }`}>
                                                {isMerged ? '⭐💖' : (isBookmarked ? '💖' : rankNum)}
                                            </span>
                                            <span className="truncate max-w-[100px]">{cand.name}</span>
                                            {badge && <span className="text-[10px]">{badge}</span>}
                                            {isCurrentActive && !isMerged && (
                                                <span className="text-[8px] bg-emerald-400 text-gray-900 px-1 py-0.2 rounded font-bold">선택됨</span>
                                            )}
                                            {isMerged && (
                                                <span className="text-[8px] bg-white text-rose-600 px-1 py-0.2 rounded font-black">선택+찜</span>
                                            )}
                                        </div>
                                        {/* 말풍선 꼬리 */}
                                        <div className="w-0 h-0 border-x-4 border-x-transparent border-t-6 mx-auto"
                                            style={{ borderTopColor: tailColor }}
                                        />
                                    </div>
                                </CustomOverlayMap>
                            );
                        })}

                        {/* 4-B. [전체동선 모드] 확정 추천 장소 커스텀 말풍선 마커 렌더링 (융합 컬러 지원) */}
                        {mode === 'full_timeline' && timelinePlaces.map((place, idx) => {
                            if (!place.lat || !place.lng) return null;
                            const orderNum = idx + 1;
                            const isFocused = place.id === focusedCardId;
                            const isBookmarked = bookmarkedPlaceIds?.has(place.id) ?? false;
                            // 확정 방문지이면서 찜까지 된 경우 -> 황금+연붉은색 융합
                            const isMerged = isBookmarked;
                            const badge = place.evidence?.displayBadges?.[0]?.emoji || '';

                            let bubbleStyle = 'bg-[#388E5A] text-white border-emerald-300 shadow-md';
                            let tailColor = '#388E5A';
                            let zIndexVal = 20 + idx;

                            if (isMerged && isFocused) {
                                bubbleStyle = 'bg-gradient-to-r from-amber-500 via-rose-500 to-rose-600 text-white border-white ring-4 ring-rose-400/60 shadow-2xl scale-110 animate-pulse';
                                tailColor = '#e11d48';
                                zIndexVal = 55;
                            } else if (isMerged) {
                                bubbleStyle = 'bg-gradient-to-r from-amber-500 via-rose-500 to-rose-600 text-white border-white ring-4 ring-rose-300/40 shadow-xl';
                                tailColor = '#e11d48';
                                zIndexVal = 45;
                            } else if (isFocused) {
                                bubbleStyle = 'bg-amber-500 text-white border-white ring-4 ring-amber-400/40 shadow-xl';
                                tailColor = '#f59e0b';
                                zIndexVal = 50;
                            }

                            return (
                                <CustomOverlayMap
                                    key={place.id}
                                    position={{ lat: place.lat, lng: place.lng }}
                                    xAnchor={0.5}
                                    yAnchor={1.0}
                                    zIndex={zIndexVal}
                                >
                                    <div
                                        onClick={() => {
                                            setFocusedCardId(prev => prev === place.id ? null : place.id);
                                        }}
                                        className={`cursor-pointer transition-transform active:scale-95 flex flex-col items-center ${
                                            isFocused ? 'scale-110 z-40' : 'scale-100 hover:scale-105'
                                        }`}
                                    >
                                        <div className={`px-2.5 py-1 rounded-xl shadow-xl flex items-center gap-1.5 border-2 text-[11px] font-black whitespace-nowrap ${bubbleStyle}`}>
                                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${
                                                isMerged ? 'bg-white text-rose-600' : (isFocused ? 'bg-white/20 text-white' : 'bg-white text-[#388E5A]')
                                            }`}>
                                                {isMerged ? '⭐💖' : orderNum}
                                            </span>
                                            <span className="truncate max-w-[100px]">{place.name}</span>
                                            {badge && <span className="text-[10px]">{badge}</span>}
                                            {isMerged && (
                                                <span className="text-[8px] bg-white text-rose-600 px-1 py-0.2 rounded font-black">확정+찜</span>
                                            )}
                                        </div>
                                        <div className="w-0 h-0 border-x-4 border-x-transparent border-t-6 mx-auto"
                                            style={{ borderTopColor: tailColor }}
                                        />
                                    </div>
                                </CustomOverlayMap>
                            );
                        })}

                        {/* 4-C. [전체동선 모드] 사용자가 찜한 대체 후보 장소 마커 표출 (도로망 주변 💖 핀) */}
                        {mode === 'full_timeline' && bookmarkedCandidatePlaces && bookmarkedCandidatePlaces.map((cCand) => {
                            if (!cCand.lat || !cCand.lng) return null;
                            const isFocused = cCand.id === focusedCardId;
                            // 포커스되면 황금색 융합
                            const bubbleStyle = isFocused
                                ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-rose-600 text-white border-white ring-4 ring-rose-400/50 shadow-xl'
                                : 'bg-rose-500 text-white border-white ring-2 ring-rose-300/40 shadow-lg';
                            const tailColor = isFocused ? '#e11d48' : '#f43f5e';

                            return (
                                <CustomOverlayMap
                                    key={`bookmarked-candidate-${cCand.id}`}
                                    position={{ lat: cCand.lat, lng: cCand.lng }}
                                    xAnchor={0.5}
                                    yAnchor={1.0}
                                    zIndex={isFocused ? 42 : 32}
                                >
                                    <div
                                        onClick={() => {
                                            setFocusedCardId(prev => prev === cCand.id ? null : cCand.id);
                                        }}
                                        className={`cursor-pointer transition-transform active:scale-95 flex flex-col items-center ${
                                            isFocused ? 'scale-110' : 'scale-100 hover:scale-105'
                                        }`}
                                    >
                                        <div className={`px-2 py-0.5 rounded-lg shadow-md flex items-center gap-1 border text-[10px] font-black whitespace-nowrap ${bubbleStyle}`}>
                                            <span className="text-[10px]">💖</span>
                                            <span className="truncate max-w-[85px]">{cCand.name}</span>
                                            <span className="text-[7.5px] bg-white/20 px-0.8 py-0.2 rounded font-bold">찜후보</span>
                                        </div>
                                        <div className="w-0 h-0 border-x-3 border-x-transparent border-t-5 mx-auto"
                                            style={{ borderTopColor: tailColor }}
                                        />
                                    </div>
                                </CustomOverlayMap>
                            );
                        })}
                    </Map>
                )}

                {/* 지도 안내 뱃지 */}
                <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full shadow-md border border-gray-200 text-[10px] text-gray-700 font-bold flex items-center gap-1.5 z-10 pointer-events-none">
                    <MapPin className="w-3 h-3 text-[#388E5A]" />
                    <span>마커 터치 시 아래에 상세 장소 카드가 나타납니다</span>
                </div>
            </div>

            {/* 하단 인터랙션 영역: 마커를 터치했을 때만 슬라이드로 쏙 등장, 닫기 버튼 또는 마커 재터치 시 완전히 숨겨져 지도가 100% 확장됨 */}
            {focusedCard && (
                <div className="bg-[#F8FAF8] p-2.5 pb-8 shrink-0 shadow-2xl border-t border-gray-200 z-10 animate-in slide-in-from-bottom-2 duration-200 max-h-[52vh] overflow-y-auto">
                    {renderCustomCard ? (
                        renderCustomCard(focusedCard, () => setFocusedCardId(null))
                    ) : (
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <h4 className="font-bold text-gray-900 text-sm truncate min-w-0 flex-1">{focusedCard.name}</h4>
                                        {mode === 'alternatives' ? (
                                            focusedCard.id === currentActiveCard?.id ? (
                                                <span className="shrink-0 whitespace-nowrap text-[9px] bg-[#388E5A] text-white px-1.5 py-0.5 rounded-sm font-medium">현재 선택됨</span>
                                            ) : (
                                                <span className="shrink-0 whitespace-nowrap text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-sm font-bold">후보 추천</span>
                                            )
                                        ) : (
                                            <span className="shrink-0 whitespace-nowrap text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-sm font-bold">확정된 장소</span>
                                        )}
                                        {bookmarkedPlaceIds?.has(focusedCard.id) && (
                                            <span className="shrink-0 whitespace-nowrap text-[9px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-sm font-bold border border-rose-200">
                                                💖 찜
                                            </span>
                                        )}
                                        {focusedCard.distanceKm !== undefined && focusedCard.distanceKm > 0 && (
                                            <span className="shrink-0 whitespace-nowrap text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/50">
                                                📍 {focusedCard.distanceKm.toFixed(1)}km
                                            </span>
                                        )}
                                    </div>
                                    {(focusedCard.metadata?.address || focusedCard.metadata?.addr || focusedCard.address) && (
                                        <p className="text-[11px] text-gray-400 mb-1 flex items-center gap-1 truncate">
                                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                                            {focusedCard.metadata?.address || focusedCard.metadata?.addr || focusedCard.address}
                                        </p>
                                    )}
                                    <p className="text-xs text-gray-500 line-clamp-1 mb-1.5 font-medium">
                                        {formatPlaceDetailText(focusedCard)}
                                    </p>
                                    {(() => {
                                        const tel = getPlacePhoneNumber(focusedCard);
                                        if (tel) {
                                            return (
                                                <a 
                                                    href={`tel:${tel}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 font-bold hover:underline mb-1.5"
                                                >
                                                    <Phone className="w-3 h-3" />
                                                    유선 확인 ({tel})
                                                </a>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                                <div className="shrink-0 flex items-center gap-1.5">
                                    {onToggleBookmark && (
                                        <button
                                            type="button"
                                            onClick={(e) => onToggleBookmark(focusedCard.id, focusedCard, e)}
                                            className={cn(
                                                "p-2 rounded-xl border transition-all active:scale-90 flex items-center justify-center",
                                                bookmarkedPlaceIds?.has(focusedCard.id)
                                                    ? "bg-rose-50 border-rose-200 text-rose-600 shadow-xs"
                                                    : "bg-gray-50 border-gray-200 text-gray-400 hover:text-rose-500 hover:bg-rose-50/50"
                                            )}
                                            title={bookmarkedPlaceIds?.has(focusedCard.id) ? "찜 해제" : "찜하기"}
                                            aria-label={bookmarkedPlaceIds?.has(focusedCard.id) ? "찜 해제" : "찜하기"}
                                        >
                                            <Heart className={cn("w-4 h-4", bookmarkedPlaceIds?.has(focusedCard.id) && "fill-rose-500 text-rose-500")} />
                                        </button>
                                    )}
                                    {mode === 'alternatives' && focusedCard.id !== currentActiveCard?.id && (
                                        <Button
                                            size="sm"
                                            onClick={() => {
                                                if (onSelectCandidate) {
                                                    onSelectCandidate(focusedCard.id);
                                                }
                                                onClose();
                                            }}
                                            className="bg-[#388E5A] hover:bg-[#2F774B] text-white font-bold text-xs h-9 px-3 rounded-xl shadow-md active:scale-95 transition-all"
                                        >
                                            <Check className="w-3.5 h-3.5 mr-1" />
                                            이 장소로 선택
                                        </Button>
                                    )}
                                    <button
                                        onClick={() => setFocusedCardId(null)}
                                        className="p-1.5 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full active:scale-90 transition-all"
                                        title="카드 닫고 지도 크게 보기"
                                        aria-label="카드 닫기"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
