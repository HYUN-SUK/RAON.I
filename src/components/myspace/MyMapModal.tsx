"use client";

import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { useReservationStore } from '@/store/useReservationStore';
import { useMySpaceStore, MapItem } from '@/store/useMySpaceStore';
import { SITES } from '@/constants/sites';
import { Modal } from '@/components/ui/Modal';
import { MapPin, Plus, ZoomIn, ZoomOut, Check, X } from 'lucide-react';
import PlaceDetailSheet from './PlaceDetailSheet';

interface MyMapModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface Cluster {
    type: 'cluster';
    id: string;
    items: MapItem[];
    x: number;
    y: number;
    count: number;
}

interface RenderableItem {
    type: 'item';
    data: MapItem;
    id: string;
    x: number;
    y: number;
}

type RenderablePin = Cluster | RenderableItem;

export default function MyMapModal({ isOpen, onClose }: MyMapModalProps) {
    const { reservations } = useReservationStore();
    const { mapItems, addMapItem } = useMySpaceStore();

    // UI States
    const [selectedItem, setSelectedItem] = useState<MapItem | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false); // New: Control sheet visibility separately
    const [isAddingMode, setIsAddingMode] = useState(false);
    const [pendingPin, setPendingPin] = useState<{ x: number, y: number } | null>(null);

    // Zoom & Pan States
    const mapRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null); // To measure viewport
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Auto-sync logic for RAON internal sites
    useEffect(() => {
        if (!isOpen) return;
        const visited = reservations.filter(r =>
            r.status === 'COMPLETED' ||
            (r.status === 'CONFIRMED' && new Date(r.checkOutDate) < new Date())
        );

        visited.forEach(r => {
            const siteInfo = SITES.find(s => s.id === r.siteId);
            const siteName = siteInfo ? `${siteInfo.name} (라온 캠핑장)` : `${r.siteId} (라온 캠핑장)`;
            const baseX = 70;
            const baseY = 25;
            const randomOffset = () => (Math.random() - 0.5) * 5;

            addMapItem({
                id: r.id,
                siteId: r.siteId,
                siteName: siteName,
                x: baseX + randomOffset(),
                y: baseY + randomOffset(),
                visitedDate: new Date(r.checkInDate).toISOString(),
                isStamped: true,
                photos: [],
                memo: '',
                rating: 0,
                isFavorite: false,
                tags: ['라온캠핑장']
            });
        });
    }, [isOpen, reservations, addMapItem]);

    // --- Zoom & Pan Logic ---

    const handleZoom = (delta: number) => {
        setScale(prev => Math.min(Math.max(prev + delta, 1), 3)); // Clamp between 1x and 3x
    };

    const handleWheel = (e: React.WheelEvent) => {
        // Optional: Support mouse wheel zoom
        // e.preventDefault();
        // const delta = e.deltaY > 0 ? -0.1 : 0.1;
        // handleZoom(delta);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (isAddingMode) return; // Don't pan when adding
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || isAddingMode) return;
        e.preventDefault();
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Touch support for Pan (Basic)
    const handleTouchStart = (e: React.TouchEvent) => {
        if (isAddingMode) return;
        const touch = e.touches[0];
        setIsDragging(true);
        setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging || isAddingMode) return;
        const touch = e.touches[0];
        setPosition({
            x: touch.clientX - dragStart.x,
            y: touch.clientY - dragStart.y
        });
    };

    // --- Map Click Logic ---

    const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isDragging) return; // Prevent click on drag end
        if (!mapRef.current) return;

        // Calculate relative coordinates regardless of zoom/pan
        // rect is the current transformed dimensions of the map image div
        const rect = mapRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        setPendingPin({ x, y });
    };

    const confirmPendingPin = () => {
        if (!pendingPin) return;

        // Open Detail Sheet in "New" mode
        setSelectedItem({
            id: 'temp-id',
            siteName: '',
            x: pendingPin.x,
            y: pendingPin.y,
            visitedDate: new Date().toISOString(),
            isStamped: true,
            photos: [],
            memo: '',
            rating: 0,
            isFavorite: false,
            tags: []
        });
        setIsAddingMode(true);
        setIsDetailOpen(true); // Open sheet for new item
    };

    const handleSaveNew = (newItem: MapItem) => {
        addMapItem({ ...newItem, id: Date.now().toString() });
        setPendingPin(null);
        setSelectedItem(null);
        setIsAddingMode(false);
        setIsDetailOpen(false); // Close sheet
    };

    const cancelPendingPin = () => {
        setPendingPin(null);
    };


    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    // Viewport & Clustering State
    const [visibleItems, setVisibleItems] = useState<MapItem[]>([]);

    // Derived State for List: Group by Date
    const getGroupedItems = () => {
        const sorted = [...visibleItems].sort((a, b) => new Date(b.visitedDate).getTime() - new Date(a.visitedDate).getTime());
        const groups: { [key: string]: MapItem[] } = {};

        sorted.forEach(item => {
            const date = new Date(item.visitedDate);
            const key = `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        return groups;
    };

    const groupedItems = getGroupedItems();

    // --- Viewport Sync Logic ---
    const updateVisibleItems = React.useCallback(() => {
        if (!mapRef.current || !containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const mapRect = mapRef.current.getBoundingClientRect();

        // Calculate visible bounds in Map % coordinates
        // Left edge of container relative to map
        const leftPct = ((containerRect.left - mapRect.left) / mapRect.width) * 100;
        const rightPct = ((containerRect.right - mapRect.left) / mapRect.width) * 100;
        const topPct = ((containerRect.top - mapRect.top) / mapRect.height) * 100;
        const bottomPct = ((containerRect.bottom - mapRect.top) / mapRect.height) * 100;

        // Filter items
        const visible = mapItems.filter(item => {
            return item.x >= leftPct && item.x <= rightPct &&
                item.y >= topPct && item.y <= bottomPct;
        });

        // Ensure we don't cause infinite loops or unnecessary re-renders
        // Simple length check or ID check implies 'good enough' for this demo
        setVisibleItems(prev => {
            if (prev.length !== visible.length) return visible;
            const isSame = prev.every((p, i) => p.id === visible[i].id);
            return isSame ? prev : visible;
        });

    }, [mapItems, scale, position]); // Depend on transform changes

    // Update visibility when map transforms
    useEffect(() => {
        updateVisibleItems();
    }, [updateVisibleItems]);


    // --- Clustering Logic (Simple Distance Based) ---
    // Returns list of Renderable Pins (either Single Item or Cluster)
    // We render this INSTEAD of mapItems directly
    const getRenderablePins = (): RenderablePin[] => {
        if (!mapRef.current) return mapItems.map(i => ({ type: 'item', data: i, id: i.id, x: i.x, y: i.y }));

        const thresholdPx = 40; // Pixel distance to group
        const mapWidth = mapRef.current.getBoundingClientRect().width;

        // Convert % to current pixels for distance Calc
        const pxPerPct = mapWidth / 100;

        const clusters: RenderablePin[] = [];
        const processed = new Set<string>();

        const sortedItems = [...mapItems].sort((a, b) => b.y - a.y); // Sort by Y for simple rendering order

        sortedItems.forEach(item => {
            if (processed.has(item.id)) return;

            // Find close neighbors
            const neighbors = sortedItems.filter(other => {
                if (item.id === other.id || processed.has(other.id)) return false;
                const dx = (item.x - other.x) * pxPerPct;
                const dy = (item.y - other.y) * pxPerPct;
                return Math.sqrt(dx * dx + dy * dy) < thresholdPx;
            });

            if (neighbors.length > 0) {
                // Create Cluster
                const clusterItems = [item, ...neighbors];
                clusterItems.forEach(i => processed.add(i.id));

                // Average position
                const avgX = clusterItems.reduce((sum, i) => sum + i.x, 0) / clusterItems.length;
                const avgY = clusterItems.reduce((sum, i) => sum + i.y, 0) / clusterItems.length;

                clusters.push({
                    type: 'cluster',
                    id: `cluster-${item.id}`,
                    items: clusterItems,
                    x: avgX,
                    y: avgY,
                    count: clusterItems.length
                });
            } else {
                processed.add(item.id);
                clusters.push({ type: 'item', data: item, id: item.id, x: item.x, y: item.y });
            }
        });

        return clusters;
    };

    const renderablePins = getRenderablePins();

    const centerOnItem = (item: MapItem) => {
        if (!containerRef.current) return;

        const newScale = 2.5; // Zoom in
        const containerW = containerRef.current.clientWidth;
        const containerH = containerRef.current.clientHeight;

        // Target position to center the item
        // item.x/100 * containerW * scale + pos = containerW / 2
        // pos = containerW/2 - (item.x/100 * containerW * scale)
        // Note: Assuming map base size matches container size roughly for calculation
        // Precision is improved by just using the formula:

        const targetX = (containerW / 2) - ((item.x / 100) * containerW * newScale);
        const targetY = (containerH / 2) - ((item.y / 100) * containerH * newScale);

        setScale(newScale);
        setPosition({ x: targetX, y: targetY });

        // Highlight
        setSelectedItem(item);
        setIsDetailOpen(true);
    };

    const centerOnCluster = (cluster: Cluster) => {
        if (!containerRef.current) return;
        const newScale = Math.min(scale + 1, 3);

        const containerW = containerRef.current.clientWidth;
        const containerH = containerRef.current.clientHeight;

        const targetX = (containerW / 2) - ((cluster.x / 100) * containerW * newScale);
        const targetY = (containerH / 2) - ((cluster.y / 100) * containerH * newScale);

        setScale(newScale);
        setPosition({ x: targetX, y: targetY });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="나만의 캠핑 지도"
            fullScreen={true} // Use full screen mode
            className="flex flex-col bg-slate-50"
        >
            {/* Search Bar - Floating (Top Right) */}
            <div className="absolute top-4 right-4 z-40 w-auto">
                <div className={`bg-white rounded-full shadow-lg border border-gray-100 flex items-center px-4 py-2 transition-all duration-300 ${isSearching ? 'w-full max-w-sm' : 'w-10 h-10 p-0 justify-center'}`}>
                    {isSearching ? (
                        <>
                            <MapPin className="text-gray-400 mr-2 shrink-0" size={16} />
                            <input
                                type="text"
                                placeholder="캠핑장 검색..."
                                className="flex-1 bg-transparent border-none text-sm focus:ring-0 outline-none placeholder:text-gray-400 min-w-0"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoFocus
                                onBlur={() => setTimeout(() => {
                                    if (!searchQuery) setIsSearching(false);
                                }, 200)}
                            />
                            <button onClick={() => { setSearchQuery(''); setIsSearching(false); }} className="ml-2 text-gray-400 hover:text-gray-600">
                                <X size={14} />
                            </button>
                        </>
                    ) : (
                        <button onClick={() => setIsSearching(true)} className="w-full h-full flex items-center justify-center text-gray-600 hover:text-brand-1 bg-white hover:bg-gray-50 rounded-full transition-colors group">
                            <div className="sr-only">검색</div>
                            {/* Enhanced Search Icon */}
                            <div className="relative">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                            </div>
                        </button>
                    )}
                </div>

                {/* Search Results Dropdown */}
                {isSearching && searchQuery && (
                    <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-60 overflow-y-auto w-64 sm:w-80">
                        {mapItems.filter(i => i.siteName.includes(searchQuery) || i.address?.includes(searchQuery)).map(item => (
                            <button
                                key={item.id}
                                className="w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 flex items-center gap-2 last:border-0"
                                onClick={() => {
                                    centerOnItem(item);
                                    setSearchQuery('');
                                    setIsSearching(false);
                                }}
                            >
                                <MapPin size={14} className="text-brand-1" />
                                <div>
                                    <div className="text-sm font-bold text-gray-800">{item.siteName}</div>
                                    <div className="text-xs text-gray-500 truncate">{item.address}</div>
                                </div>
                            </button>
                        ))}
                        {mapItems.filter(i => i.siteName.includes(searchQuery)).length === 0 && (
                            <div className="p-4 text-center text-sm text-gray-400">검색 결과가 없습니다.</div>
                        )}
                    </div>
                )}
            </div>

            {/* Main Scrollable Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden bg-surface-1 pb-20 relative">
                {/* Map Area - Fixed Height */}
                <div
                    className="relative w-full h-[55vh] bg-[#F5F5F0] overflow-hidden group select-none shrink-0"
                    ref={containerRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleMouseUp}
                >
                    {/* Scalable/Draggable Layer */}
                    <div
                        ref={mapRef}
                        className="absolute w-full h-full origin-center transition-transform duration-75 ease-out"
                        style={{
                            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                            cursor: isDragging ? 'grabbing' : 'grab'
                        }}
                        onClick={handleMapClick}
                    >
                        <Image
                            src="/images/korea_map_view.png"
                            alt="Korea Map"
                            fill
                            className="object-contain p-8 opacity-80 pointer-events-none"
                            priority
                        />

                        {/* Render Clusters and Pins */}
                        {renderablePins.map(pin => {
                            if (pin.type === 'cluster') {
                                return (
                                    <button
                                        key={pin.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            centerOnCluster(pin);
                                        }}
                                        className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110 z-20"
                                        style={{
                                            left: `${pin.x}%`,
                                            top: `${pin.y}%`,
                                            transform: `translate(-50%, -50%) scale(${1 / scale})`
                                        }}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-brand-1 text-white border-2 border-white shadow-lg flex items-center justify-center font-bold text-sm">
                                            {pin.count}
                                        </div>
                                    </button>
                                );
                            } else {
                                const item = pin.data as MapItem;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsAddingMode(false);
                                            setSelectedItem(item);
                                            // Scroll to item in list
                                            const listElement = document.getElementById(`map-item-${item.id}`);
                                            if (listElement) {
                                                listElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            }
                                        }}
                                        className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-125 z-10"
                                        style={{
                                            left: `${item.x}%`,
                                            top: `${item.y}%`,
                                            transform: `translate(-50%, -50%) scale(${1 / scale})`
                                        }}
                                    >
                                        <div className="flex flex-col items-center group/pin">
                                            <div className="w-8 h-8 rounded-full bg-brand-1 border-2 border-white shadow-md flex items-center justify-center text-white relative">
                                                <MapPin size={16} fill="currentColor" />
                                            </div>
                                            <span className={`mt-1 px-2 py-0.5 bg-white/90 backdrop-blur rounded text-[10px] font-bold text-gray-800 shadow-sm whitespace-nowrap max-w-[100px] truncate ${scale < 1.5 ? 'hidden group-hover/pin:block' : 'block'}`}>
                                                {item.siteName}
                                            </span>
                                        </div>
                                    </button>
                                );
                            }
                        })}

                        {/* Pending Pin */}
                        {pendingPin && (
                            <div
                                className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
                                style={{ left: `${pendingPin.x}%`, top: `${pendingPin.y}%` }}
                            >
                                <div className="w-8 h-8 rounded-full bg-red-500 border-2 border-white shadow-lg flex items-center justify-center text-white animate-bounce">
                                    <Plus size={20} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* UI Overlay Controls - Moved to bottom right of map area */}
                    <div className="absolute right-4 bottom-24 flex flex-col gap-2 z-30">
                        <button onClick={() => handleZoom(0.5)} className="p-2.5 bg-white rounded-full shadow-lg border border-gray-100 text-gray-700 active:scale-95"><ZoomIn size={20} /></button>
                        <button onClick={() => handleZoom(-0.5)} className="p-2.5 bg-white rounded-full shadow-lg border border-gray-100 text-gray-700 active:scale-95"><ZoomOut size={20} /></button>
                    </div>

                    {/* Pending Pin Confirmation Tooltip */}
                    {pendingPin && (
                        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white px-4 py-3 rounded-2xl shadow-xl z-30 flex items-center gap-3 animate-in slide-in-from-bottom-5 w-max">
                            <span className="text-sm font-bold text-gray-700">이 위치에 추가할까요?</span>
                            <div className="flex gap-2">
                                <button onClick={confirmPendingPin} className="p-1.5 bg-blue-500 text-white rounded-full hover:bg-blue-600"><Check size={16} /></button>
                                <button onClick={cancelPendingPin} className="p-1.5 bg-gray-200 text-gray-500 rounded-full hover:bg-gray-300"><X size={16} /></button>
                            </div>
                        </div>
                    )}
                </div>

                {/* List View - Flows naturally below map */}
                <div className="bg-white border-t border-gray-100 p-0 flex flex-col relative z-20 shrink-0 min-h-[50vh]">
                    {/* Header for list */}
                    <div className="p-4 bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-gray-900">
                            지도에 보이는 곳
                        </h3>
                        <span className="text-sm font-normal text-brand-1 bg-brand-1/10 px-2 py-0.5 rounded-full">{visibleItems.length}곳</span>
                    </div>

                    {visibleItems.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 text-sm flex flex-col items-center justify-center h-40">
                            <MapPin size={32} className="mb-3 opacity-30" />
                            <p>이 지역에는 기록이 없어요.<br />지도를 움직여보세요!</p>
                        </div>
                    ) : (
                        <div className="pb-32">
                            {Object.entries(groupedItems).map(([groupKey, groupItems]) => (
                                <div key={groupKey}>
                                    {/* Group Header */}
                                    <div className="px-4 py-2 bg-gray-50 text-xs font-bold text-gray-500 sticky top-[60px] z-[5] border-b border-gray-100">
                                        {groupKey}
                                    </div>
                                    <div className="px-4 py-2 space-y-3">
                                        {groupItems.map(item => (
                                            <button
                                                key={item.id}
                                                id={`map-item-${item.id}`} // Add ID for scrolling
                                                onClick={() => {
                                                    setSelectedItem(item);
                                                    setIsAddingMode(false);
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
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Detail Sheet Overlay */}
            <PlaceDetailSheet
                item={selectedItem}
                isOpen={isDetailOpen}
                onClose={() => {
                    setIsDetailOpen(false);
                }}
                isNew={isAddingMode}
                onSaveNew={handleSaveNew}
            />
        </Modal>
    );
}
