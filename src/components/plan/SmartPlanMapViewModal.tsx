'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Map, Polyline, CustomOverlayMap, useKakaoLoader } from 'react-kakao-maps-sdk';
import { X, MapPin, Phone, Check, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPlaceDetailText, getPlacePhoneNumber } from '@/utils/placeFormatter';
import { useModalBackHandler } from '@/hooks/useModalBackHandler';

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
    renderCustomCard
}: SmartPlanMapViewModalProps) {
    // 1. 카카오맵 SDK 로더
    const [loading, error] = useKakaoLoader({
        appkey: process.env.NEXT_PUBLIC_KAKAO_JS_KEY!,
        libraries: ['services', 'clusterer'],
    });

    // 모바일 뒤로가기 제어
    useModalBackHandler(isOpen, onClose, 'smartPlanMapModal');

    // 맵 인스턴스
    const [map, setMap] = useState<any>(null);

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

    // 3. 카카오 LatLngBounds 자동 화면 피팅
    useEffect(() => {
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
    }, [map, mode, candidateCards, timelinePlaces, baseRoutePath, origin, destination]);

    // 4. 포커스된 장소 정보 (대체리스트 모드 or 전체동선 모드 통합 지원)
    const focusedCard = useMemo(() => {
        if (!focusedCardId) return null;
        if (mode === 'alternatives') {
            return candidateCards.find(c => c.id === focusedCardId) || null;
        } else {
            return timelinePlaces.find(p => p.id === focusedCardId) || null;
        }
    }, [focusedCardId, mode, candidateCards, timelinePlaces]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[999] flex flex-col bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            {/* 상단 컨트롤 헤더 */}
            <div className="bg-[#112419] text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-lg border-b border-white/10 z-10">
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
                className="relative flex-1 w-full bg-gray-100 overflow-hidden"
                style={{ touchAction: 'none' }} // 모바일 지도 드래그 시 모달 스크롤 간섭 방지
            >
                {loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/90 z-20 space-y-3">
                        <div className="w-9 h-9 border-4 border-[#224732]/20 border-t-[#224732] rounded-full animate-spin" />
                        <p className="text-xs font-bold text-[#224732]">카카오 정밀 지도를 로딩 중입니다...</p>
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
                                strokeColor="#224732"
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
                                    <div className="px-2.5 py-1 bg-[#224732] text-white text-[11px] font-black rounded-full shadow-lg border-2 border-emerald-300 flex items-center gap-1">
                                        <span>🚩</span>
                                        <span>{destinationName}</span>
                                    </div>
                                    <div className="w-0 h-0 border-x-4 border-x-transparent border-t-6 border-t-[#224732] mx-auto" />
                                </div>
                            </CustomOverlayMap>
                        )}

                        {/* 4-A. [대체리스트 모드] 후보 장소 커스텀 말풍선 마커 렌더링 */}
                        {mode === 'alternatives' && candidateCards.map((cand, idx) => {
                            if (!cand.lat || !cand.lng) return null;
                            const isCurrentActive = cand.id === currentActiveCard?.id;
                            const isFocused = cand.id === focusedCardId;
                            const badge = cand.evidence?.displayBadges?.[0]?.emoji || '';
                            const rankNum = idx + 1;

                            return (
                                <CustomOverlayMap
                                    key={cand.id}
                                    position={{ lat: cand.lat, lng: cand.lng }}
                                    xAnchor={0.5}
                                    yAnchor={1.0}
                                    zIndex={isFocused ? 40 : (isCurrentActive ? 30 : 10)}
                                >
                                    <div
                                        onClick={() => {
                                            setFocusedCardId(prev => prev === cand.id ? null : cand.id);
                                        }}
                                        className={`cursor-pointer transition-transform active:scale-95 flex flex-col items-center ${
                                            isFocused ? 'scale-110 z-40' : 'scale-100 hover:scale-105'
                                        }`}
                                    >
                                        <div className={`px-2.5 py-1 rounded-xl shadow-xl flex items-center gap-1.5 border-2 text-[11px] font-black whitespace-nowrap ${
                                            isFocused
                                                ? 'bg-amber-500 text-white border-white ring-4 ring-amber-400/40'
                                                : isCurrentActive
                                                    ? 'bg-[#224732] text-white border-emerald-300'
                                                    : 'bg-white text-gray-900 border-gray-200'
                                        }`}>
                                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${
                                                isFocused || isCurrentActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                                            }`}>
                                                {rankNum}
                                            </span>
                                            <span className="truncate max-w-[100px]">{cand.name}</span>
                                            {badge && <span className="text-[10px]">{badge}</span>}
                                            {isCurrentActive && (
                                                <span className="text-[8px] bg-emerald-400 text-gray-900 px-1 py-0.2 rounded font-bold">선택됨</span>
                                            )}
                                        </div>
                                        {/* 말풍선 꼬리: 하단 끝이 좌표에 100% 자석 고정 */}
                                        <div className="w-0 h-0 border-x-4 border-x-transparent border-t-6 mx-auto"
                                            style={{
                                                borderTopColor: isFocused ? '#f59e0b' : (isCurrentActive ? '#224732' : '#ffffff')
                                            }}
                                        />
                                    </div>
                                </CustomOverlayMap>
                            );
                        })}

                        {/* 4-B. [전체동선 모드] 확정 추천 장소 커스텀 말풍선 마커 렌더링 (동선 연결선 제거) */}
                        {mode === 'full_timeline' && timelinePlaces.map((place, idx) => {
                            if (!place.lat || !place.lng) return null;
                            const orderNum = idx + 1;
                            const isFocused = place.id === focusedCardId;
                            const badge = place.evidence?.displayBadges?.[0]?.emoji || '';

                            return (
                                <CustomOverlayMap
                                    key={place.id}
                                    position={{ lat: place.lat, lng: place.lng }}
                                    xAnchor={0.5}
                                    yAnchor={1.0}
                                    zIndex={isFocused ? 40 : 20 + idx}
                                >
                                    <div
                                        onClick={() => {
                                            setFocusedCardId(prev => prev === place.id ? null : place.id);
                                        }}
                                        className={`cursor-pointer transition-transform active:scale-95 flex flex-col items-center ${
                                            isFocused ? 'scale-110 z-40' : 'scale-100 hover:scale-105'
                                        }`}
                                    >
                                        <div className={`px-2.5 py-1 rounded-xl shadow-xl flex items-center gap-1.5 border-2 text-[11px] font-black whitespace-nowrap ${
                                            isFocused
                                                ? 'bg-amber-500 text-white border-white ring-4 ring-amber-400/40'
                                                : 'bg-[#224732] text-white border-emerald-300'
                                        }`}>
                                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${
                                                isFocused ? 'bg-white/20 text-white' : 'bg-white text-[#224732]'
                                            }`}>
                                                {orderNum}
                                            </span>
                                            <span className="truncate max-w-[100px]">{place.name}</span>
                                            {badge && <span className="text-[10px]">{badge}</span>}
                                        </div>
                                        <div className="w-0 h-0 border-x-4 border-x-transparent border-t-6 mx-auto"
                                            style={{
                                                borderTopColor: isFocused ? '#f59e0b' : '#224732'
                                            }}
                                        />
                                    </div>
                                </CustomOverlayMap>
                            );
                        })}
                    </Map>
                )}

                {/* 지도 안내 뱃지 */}
                <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full shadow-md border border-gray-200 text-[10px] text-gray-700 font-bold flex items-center gap-1.5 z-10 pointer-events-none">
                    <MapPin className="w-3 h-3 text-[#224732]" />
                    <span>마커 터치 시 아래에 상세 장소 카드가 나타납니다</span>
                </div>
            </div>

            {/* 하단 인터랙션 영역: 마커를 터치했을 때만 슬라이드로 쏙 등장, 닫기 버튼 또는 마커 재터치 시 완전히 숨겨져 지도가 100% 확장됨 */}
            {focusedCard && (
                <div className="bg-[#F7F5EF] p-2.5 pb-8 shrink-0 shadow-2xl border-t border-gray-200 z-10 animate-in slide-in-from-bottom-2 duration-200 max-h-[52vh] overflow-y-auto">
                    {renderCustomCard ? (
                        renderCustomCard(focusedCard, () => setFocusedCardId(null))
                    ) : (
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-bold text-gray-900 text-sm truncate">{focusedCard.name}</h4>
                                        {mode === 'alternatives' ? (
                                            focusedCard.id === currentActiveCard?.id ? (
                                                <span className="text-[9px] bg-[#224732] text-white px-1.5 py-0.5 rounded-sm font-medium">현재 선택됨</span>
                                            ) : (
                                                <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-sm font-bold">후보 추천</span>
                                            )
                                        ) : (
                                            <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-sm font-bold">확정된 장소</span>
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
                                <div className="shrink-0 flex items-center gap-2">
                                    {mode === 'alternatives' && focusedCard.id !== currentActiveCard?.id && (
                                        <Button
                                            size="sm"
                                            onClick={() => {
                                                if (onSelectCandidate) {
                                                    onSelectCandidate(focusedCard.id);
                                                }
                                                onClose();
                                            }}
                                            className="bg-[#224732] hover:bg-[#1a3827] text-white font-bold text-xs h-9 px-3 rounded-xl shadow-md active:scale-95 transition-all"
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
