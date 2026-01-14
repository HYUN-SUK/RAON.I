"use client";

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useReservationStore } from '@/store/useReservationStore';
import { useMySpaceStore, MapItem } from '@/store/useMySpaceStore';
import { SITES } from '@/constants/sites';
import { Modal } from '@/components/ui/Modal';
import { MapPin, Search, Plus, Loader2, Navigation, Check, X, Locate } from 'lucide-react';
import PlaceDetailSheet from './PlaceDetailSheet';
import { DEFAULT_CAMPING_LOCATION } from '@/constants/location';
import { Map, MapMarker, MarkerClusterer, useKakaoLoader, CustomOverlayMap } from 'react-kakao-maps-sdk';
import { toast } from 'sonner';

// Kakao Maps SDK Type Augmentation for TypeScript
declare global {
    interface Window {
        kakao: any;
    }
}

interface MyMapModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function MyMapModal({ isOpen, onClose }: MyMapModalProps) {
    // 1. Load Kakao Maps SDK
    const [loading, error] = useKakaoLoader({
        appkey: process.env.NEXT_PUBLIC_KAKAO_JS_KEY!, // Use env variable
        libraries: ['clusterer', 'services'],
    });

    const { reservations } = useReservationStore();
    const { mapItems, addMapItem, updateMapItem } = useMySpaceStore();

    // UI States
    const [selectedItem, setSelectedItem] = useState<MapItem | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isAddingMode, setIsAddingMode] = useState(false);

    // Search States
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]); // Kakao Places result
    const [visibleCount, setVisibleCount] = useState(10); // Pagination for list

    // Map States
    const mapRef = useRef<any>(null); // Kakao Map Instance
    const [center, setCenter] = useState<{ lat: number, lng: number }>(
        { lat: DEFAULT_CAMPING_LOCATION.latitude, lng: DEFAULT_CAMPING_LOCATION.longitude }
    );
    // Temporary pin for adding new location
    const [pendingPin, setPendingPin] = useState<{ lat: number, lng: number, name?: string, address?: string } | null>(null);
    // Timestamp to skip map click after search selection (using window to bypass React closure)
    // @ts-ignore
    if (typeof window !== 'undefined' && window.__skipMapClickUntil === undefined) {
        // @ts-ignore
        window.__skipMapClickUntil = 0;
    }

    // 2. Data Migration: Legacy Items (Raon Internal) -> Real Coordinates
    useEffect(() => {
        if (!isOpen) return;

        // 2-1. Sync from Reservations (Auto-add Raon visits)
        const visited = reservations.filter(r =>
            r.status === 'COMPLETED' ||
            (r.status === 'CONFIRMED' && new Date(r.checkOutDate) < new Date())
        );

        visited.forEach(r => {
            const exists = mapItems.some(i => i.id === r.id);
            if (!exists) {
                const siteInfo = SITES.find(s => s.id === r.siteId);
                const siteName = siteInfo ? `${siteInfo.name} (라온 캠핑장)` : `${r.siteId} (라온 캠핑장)`;

                // Add new item with Real Coordinates (Raon Location + Random Jitter)
                const jitter = () => (Math.random() - 0.5) * 0.002; // Very small offset set (~100m)

                addMapItem({
                    id: r.id,
                    siteId: r.siteId,
                    siteName: siteName,
                    x: 50, // Legacy fallback
                    y: 50, // Legacy fallback
                    lat: DEFAULT_CAMPING_LOCATION.latitude + jitter(),
                    lng: DEFAULT_CAMPING_LOCATION.longitude + jitter(),
                    visitedDate: new Date(r.checkInDate).toISOString(),
                    isStamped: true,
                    photos: [],
                    memo: '',
                    rating: 0,
                    isFavorite: false,
                    tags: ['라온캠핑장'],
                    address: '충청남도 예산군 응봉면 입침리 341'
                });
            }
        });

        // 2-2. Migrate Existing Legacy Items (Missing lat/lng)
        mapItems.forEach(item => {
            if (!item.lat || !item.lng) {
                // If it looks like a Raon site, assign Raon coords
                if (item.siteName.includes('라온') || item.tags.includes('라온캠핑장')) {
                    const jitter = () => (Math.random() - 0.5) * 0.002;
                    updateMapItem(item.id, {
                        lat: DEFAULT_CAMPING_LOCATION.latitude + jitter(),
                        lng: DEFAULT_CAMPING_LOCATION.longitude + jitter(),
                        address: '충청남도 예산군 응봉면 입침리 341'
                    });
                } else {
                    // For unknown legacy items, default to Seoul or Raon? 
                    // Let's default to Raon for safety as that was the only context before.
                    const jitter = () => (Math.random() - 0.5) * 0.002;
                    updateMapItem(item.id, {
                        lat: DEFAULT_CAMPING_LOCATION.latitude + jitter(),
                        lng: DEFAULT_CAMPING_LOCATION.longitude + jitter(),
                    });
                }
            }
        });

    }, [isOpen, reservations, mapItems, addMapItem, updateMapItem]);


    // 3. Search Logic (Kakao Places)
    useEffect(() => {
        if (!searchQuery || !window.kakao || !window.kakao.maps.services) {
            setSearchResults([]);
            return;
        }

        const ps = new window.kakao.maps.services.Places();

        // Search for "Camping" related keywords
        // If user query doesn't contain "캠핑", maybe append it? or just raw search.
        // Let's do raw search but prioritize camping category 'AD5' (Accommodation) if possible, 
        // but keyword search is usually enough.

        ps.keywordSearch(searchQuery, (data: any[], status: any) => {
            if (status === window.kakao.maps.services.Status.OK) {
                setSearchResults(data);
            } else {
                setSearchResults([]);
            }
        });

    }, [searchQuery]);


    // 5. List Search State
    const [listSearchQuery, setListSearchQuery] = useState('');

    // Filtered Items for List
    const getFilteredItems = () => {
        let items = [...mapItems].sort((a, b) => new Date(b.visitedDate).getTime() - new Date(a.visitedDate).getTime());

        if (listSearchQuery) {
            const query = listSearchQuery.toLowerCase();
            items = items.filter(item =>
                item.siteName.toLowerCase().includes(query) ||
                item.address?.toLowerCase().includes(query) ||
                item.tags?.some(tag => tag.toLowerCase().includes(query)) ||
                item.memo?.toLowerCase().includes(query)
            );
        }
        return items;
    };

    const filteredItems = getFilteredItems();
    const displayItems = filteredItems.slice(0, visibleCount);


    // --- Handlers ---

    const handleSearchSelect = (place: any) => {
        const lat = parseFloat(place.y);
        const lng = parseFloat(place.x);

        // Show "Add this location?" pin FIRST before changing center
        const pinData = {
            lat,
            lng,
            name: place.place_name,
            address: place.road_address_name || place.address_name || '주소 정보 없음'
        };
        setPendingPin(pinData);

        // Set skip timestamp to prevent map click from overwriting (10 seconds window)
        // @ts-ignore
        window.__skipMapClickUntil = Date.now() + 10000;

        setSearchQuery('');
        setIsSearching(false);
        setCenter({ lat, lng });
    };

    const handleMapClick = (_: any, mouseEvent: any) => {
        const now = Date.now();
        // @ts-ignore
        const skipUntil = window.__skipMapClickUntil || 0;

        // Skip if triggered by search selection (within 2 second window)
        if (now < skipUntil) {
            return;
        }

        // Click to add custom spot with Reverse Geocoding
        const lat = mouseEvent.latLng.getLat();
        const lng = mouseEvent.latLng.getLng();

        // Initially set with loading state
        setPendingPin({
            lat,
            lng,
            name: '새로운 캠핑장',
            address: '주소 불러오는 중...'
        });

        // Use Kakao Geocoder for Reverse Geocoding
        if (window.kakao && window.kakao.maps.services) {
            const geocoder = new window.kakao.maps.services.Geocoder();
            geocoder.coord2Address(lng, lat, (result: any[], status: any) => {
                if (status === window.kakao.maps.services.Status.OK && result[0]) {
                    const addressData = result[0];
                    // Prefer road_address if available, otherwise use address
                    const fetchedAddress = addressData.road_address
                        ? addressData.road_address.address_name
                        : addressData.address?.address_name || '주소 정보 없음';
                    setPendingPin({
                        lat,
                        lng,
                        name: '새로운 캠핑장',
                        address: fetchedAddress
                    });
                } else {
                    setPendingPin({
                        lat,
                        lng,
                        name: '새로운 캠핑장',
                        address: '주소 정보 없음'
                    });
                }
            });
        }
    };

    const confirmPendingPin = () => {
        if (!pendingPin) return;

        const newItem = {
            id: 'temp-id',
            siteName: pendingPin.name || '새로운 장소',
            x: 50, // Legacy
            y: 50, // Legacy
            lat: pendingPin.lat,
            lng: pendingPin.lng,
            address: pendingPin.address || '',
            visitedDate: new Date().toISOString(),
            isStamped: true,
            photos: [],
            memo: '',
            rating: 0,
            isFavorite: false,
            tags: []
        };
        setSelectedItem(newItem);
        setIsAddingMode(true);
        setIsDetailOpen(true);
    };

    const handleSaveNew = (newItem: MapItem) => {
        addMapItem({ ...newItem, id: Date.now().toString() });
        setPendingPin(null);
        setSelectedItem(null);
        setIsAddingMode(false);
        setIsDetailOpen(false);
        setVisibleCount(10); // Reset pagination
        toast.success('나만의 지도에 추가되었습니다!');

        // Scroll to top of list after a short delay
        setTimeout(() => {
            const listHeader = document.querySelector('[data-list-header]');
            listHeader?.scrollIntoView({ behavior: 'smooth' });
        }, 300);
    };

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="나만의 캠핑 지도"
            fullScreen={true}
            className="flex flex-col bg-slate-50 overflow-y-auto"
        >
            {/* Search Bar - Floating (Top Right) */}
            <div className="absolute top-4 right-4 z-[100] w-auto flex flex-col items-end gap-2">
                <div className={`bg-white rounded-full shadow-lg border border-gray-100 flex items-center px-4 py-3 transition-all duration-300 ${isSearching ? 'w-full max-w-sm' : 'w-12 h-12 p-0 justify-center'}`}>
                    {isSearching ? (
                        <>
                            <Search className="text-gray-400 mr-2 shrink-0" size={20} />
                            <input
                                type="text"
                                placeholder="캠핑장 이름 검색..."
                                className="flex-1 bg-transparent border-none text-base focus:ring-0 outline-none placeholder:text-gray-400 min-w-0"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoFocus
                                onBlur={() => setTimeout(() => {
                                    // Delay hiding to allow click on result
                                }, 200)}
                            />
                            <button onClick={() => { setSearchQuery(''); setIsSearching(false); }} className="ml-2 text-gray-400 hover:text-gray-600">
                                <X size={18} />
                            </button>
                        </>
                    ) : (
                        <button onClick={() => setIsSearching(true)} className="w-full h-full flex items-center justify-center text-gray-600 hover:text-brand-1 bg-white hover:bg-gray-50 rounded-full transition-colors group">
                            <div className="sr-only">검색</div>
                            <Search size={24} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" />
                        </button>
                    )}
                </div>

                {/* Search Results */}
                {isSearching && searchQuery && (
                    <div className="bg-white rounded-xl shadow-xl border border-gray-100 max-h-60 overflow-y-auto w-64 sm:w-80 mt-2">
                        {searchResults.length > 0 ? searchResults.map((place) => (
                            <button
                                key={place.id}
                                className="w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 flex items-center gap-2 last:border-0"
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    // @ts-ignore
                                    window.__skipMapClickUntil = Date.now() + 10000;
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // @ts-ignore
                                    window.__skipMapClickUntil = Date.now() + 10000;
                                    handleSearchSelect(place);
                                }}
                            >
                                <MapPin size={16} className="text-brand-1 shrink-0" />
                                <div className="min-w-0">
                                    <div className="text-sm font-bold text-gray-800 truncate">{place.place_name}</div>
                                    <div className="text-xs text-gray-500 truncate">{place.road_address_name || place.address_name}</div>
                                </div>
                            </button>
                        )) : (
                            <div className="p-4 text-center text-sm text-gray-400">
                                {window.kakao ? '검색 결과가 없습니다.' : '지도 로딩 중...'}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Map Area */}
            <div className="w-full h-[65vh] relative shrink-0">
                {loading ? (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <Loader2 className="animate-spin text-brand-1" size={32} />
                        <span className="ml-2 text-gray-500 font-medium">지도 불러오는 중...</span>
                    </div>
                ) : error ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 p-6 text-center">
                        <MapPin className="text-gray-300 mb-2" size={48} />
                        <p className="text-gray-500 font-bold">지도를 불러올 수 없습니다.</p>
                        <p className="text-xs text-red-400 mt-1">{error.message}</p>
                        <p className="text-xs text-gray-400 mt-2">관리자에게 문의해주세요.</p>
                    </div>
                ) : (
                    <Map
                        center={center}
                        style={{ width: "100%", height: "100%" }}
                        level={10} // Initial Zoom Level (Country Wide like)
                        onClick={handleMapClick}
                        ref={mapRef}
                    >
                        <MarkerClusterer
                            averageCenter={true}
                            minLevel={10} // Cluster at high levels (zoomed out)
                        >
                            {mapItems.map((item) => {
                                if (!item.lat || !item.lng) return null;
                                return (
                                    <MapMarker
                                        key={item.id}
                                        position={{ lat: item.lat, lng: item.lng }}
                                        onClick={() => {
                                            setSelectedItem(item);
                                            setIsAddingMode(false);
                                            // Scroll to item
                                            const el = document.getElementById(`map-item-${item.id}`);
                                            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }}
                                        image={{
                                            src: "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png", // Yellow star flag marker
                                            size: { width: 24, height: 35 },
                                            options: { offset: { x: 12, y: 35 } }
                                        }}
                                    >
                                        {/* Simple Label on Hover or Always? Let's use CustomOverlay for labels if needed */}
                                    </MapMarker>
                                );
                            })}
                        </MarkerClusterer>

                        {/* Labels (Custom Overlay) - Show names for favorites or selected? */}
                        {mapItems.map(item => {
                            if (!item.lat || !item.lng) return null;
                            // Show label if zoomed in enough? For now simple always show if not too many? 
                            // Or better: Just show for selected item
                            if (selectedItem?.id !== item.id) return null;

                            return (
                                <CustomOverlayMap
                                    key={`label-${item.id}`}
                                    position={{ lat: item.lat, lng: item.lng }}
                                    yAnchor={2.2} // Above the marker
                                >
                                    <div className="bg-white px-3 py-1 rounded-lg shadow-md border border-gray-100 text-xs font-bold whitespace-nowrap animate-in fade-in zoom-in duration-200">
                                        {item.siteName}
                                    </div>
                                </CustomOverlayMap>
                            )
                        })}

                        {/* Pending Pin Marker */}
                        {pendingPin && (
                            <MapMarker
                                position={{ lat: pendingPin.lat, lng: pendingPin.lng }}
                                image={{
                                    src: "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png", // Default star marker
                                    size: { width: 24, height: 35 }
                                }}
                            />
                        )}

                        {/* Pending Pin Confirmation Tooltip */}
                        {pendingPin && (
                            <CustomOverlayMap
                                key={`pending-${pendingPin.lat}-${pendingPin.lng}-${pendingPin.address}`}
                                position={{ lat: pendingPin.lat, lng: pendingPin.lng }}
                                yAnchor={1.5}
                            >
                                <div className="bg-white px-4 py-3 rounded-2xl shadow-xl z-30 flex items-center gap-3 animate-in slide-in-from-bottom-5 max-w-[280px]">
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <span className="text-sm font-bold text-gray-800 truncate">{pendingPin.name || "새로운 장소"}</span>
                                        {pendingPin.address && (
                                            <span className="text-[10px] text-gray-500 truncate">{pendingPin.address}</span>
                                        )}
                                        <span className="text-[10px] text-brand-1 mt-0.5">이곳을 추가할까요?</span>
                                    </div>
                                    <div className="flex gap-2 flex-shrink-0">
                                        <button
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onClick={(e) => { e.stopPropagation(); confirmPendingPin(); }}
                                            className="p-1.5 bg-brand-1 text-white rounded-full hover:bg-brand-1/90 shadow-sm"
                                        >
                                            <Check size={14} strokeWidth={3} />
                                        </button>
                                        <button
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onClick={(e) => { e.stopPropagation(); setPendingPin(null); }}
                                            className="p-1.5 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200"
                                        >
                                            <X size={14} strokeWidth={3} />
                                        </button>
                                    </div>
                                </div>
                            </CustomOverlayMap>
                        )}
                    </Map>
                )}

                {/* Current Location Button */}
                <button
                    className="absolute bottom-4 right-4 bg-white px-4 py-2.5 rounded-full shadow-lg z-10 text-gray-700 hover:text-brand-1 active:scale-95 transition-all flex items-center gap-2"
                    onClick={() => {
                        if (!mapRef.current) return;
                        if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition((pos) => {
                                const lat = pos.coords.latitude;
                                const lng = pos.coords.longitude;
                                mapRef.current.setCenter(new window.kakao.maps.LatLng(lat, lng));
                                mapRef.current.setLevel(5);
                                setCenter({ lat, lng });
                                toast.success("현재 위치로 이동했습니다.");
                            });
                        } else {
                            toast.error("위치 정보를 사용할 수 없습니다.");
                        }
                    }}
                >
                    <Locate size={18} />
                    <span className="text-xs font-bold">현위치</span>
                </button>
            </div>

            {/* List View */}
            <div className="bg-surface-1 pb-10 relative z-20 flex flex-col min-h-screen">
                <div data-list-header className="p-4 bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10 space-y-3">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                            <Navigation size={18} className="text-brand-1" />
                            나의 캠핑 기록
                        </h3>
                        <span className="text-xs font-bold text-brand-1 bg-brand-1/10 px-2.5 py-1 rounded-full">{mapItems.length}곳 정복!</span>
                    </div>
                    {/* 5. List Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="내 기록 검색 (이름, 주소, 메모)"
                            className="w-full bg-gray-50 border-none rounded-xl py-2.5 pl-9 pr-4 text-sm focus:ring-1 focus:ring-brand-1/50 transition-all"
                            value={listSearchQuery}
                            onChange={(e) => setListSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {displayItems.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-gray-400 text-sm">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <MapPin size={28} className="opacity-30" />
                        </div>
                        <p className="text-center">
                            {listSearchQuery ? '검색 결과가 없어요.' : <>아직 기록된 캠핑장이 없어요.<br />지도에서 찾아보세요!</>}
                        </p>
                    </div>
                ) : (
                    <div className="p-4 space-y-3">
                        {displayItems.map(item => (
                            <button
                                key={item.id}
                                id={`map-item-${item.id}`}
                                onClick={() => {
                                    setSelectedItem(item);
                                    if (mapRef.current && item.lat && item.lng) {
                                        mapRef.current.setCenter(new window.kakao.maps.LatLng(item.lat, item.lng));
                                        mapRef.current.setLevel(4);
                                    }
                                    setIsDetailOpen(true);
                                }}
                                className={`w-full flex items-center gap-3 p-4 border rounded-2xl shadow-sm text-left transition-all ${selectedItem?.id === item.id
                                    ? 'bg-brand-1/5 border-brand-1 ring-1 ring-brand-1'
                                    : 'bg-white border-gray-100 hover:border-brand-1/30 hover:shadow-md'
                                    }`}
                            >
                                <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100">
                                    <MapPin size={20} className="text-brand-1" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-gray-900 truncate text-base">{item.siteName}</span>
                                        {item.isFavorite && <span className="text-red-400 text-xs">❤</span>}
                                    </div>
                                    <div className="flex items-center text-xs text-gray-500 gap-2">
                                        <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{new Date(item.visitedDate).toLocaleDateString()}</span>
                                        {item.address && <span className="truncate max-w-[120px]">{item.address}</span>}
                                    </div>
                                    {/* Show Memo Snippet if exists */}
                                    {item.memo && (
                                        <p className="text-xs text-gray-400 mt-1 truncate">"{item.memo}"</p>
                                    )}
                                </div>
                            </button>
                        ))}

                        {/* Load More Button */}
                        {visibleCount < filteredItems.length && (
                            <button
                                onClick={() => setVisibleCount(prev => prev + 10)}
                                className="w-full py-4 bg-gray-50 text-gray-600 font-medium rounded-2xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus size={18} />
                                <span>더 보기 ({filteredItems.length - visibleCount}개 남음)</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Detail Sheet Overlay */}
            <PlaceDetailSheet
                item={selectedItem}
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                isNew={isAddingMode}
                onSaveNew={handleSaveNew}
            />
        </Modal>
    );
}
