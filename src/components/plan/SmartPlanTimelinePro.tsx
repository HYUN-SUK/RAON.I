'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation, Clock, EyeOff, ArrowRightLeft, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { ProTimelinePlan, TimelineBlock, TimelineDay, FactCard } from '@/lib/smartPlan';
import { recalcTimelineFrom } from '@/lib/timelineBuilder';
import { openNavApp } from '@/lib/nav-utils';

// ========================================================================================
// Constants
// ========================================================================================

const BLOCK_ICONS: Record<TimelineBlock['type'], string> = {
    move: '🚗', meal: '🍽️', activity: '📸', cafe: '☕', rest: '🏕️', setup: '⛺', free: '🌿',
};

const BLOCK_COLORS: Record<TimelineBlock['type'], string> = {
    move: 'bg-blue-50 border-blue-200 text-blue-700',
    meal: 'bg-orange-50 border-orange-200 text-orange-700',
    activity: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    cafe: 'bg-amber-50 border-amber-200 text-amber-700',
    rest: 'bg-[#224732]/5 border-[#224732]/20 text-[#224732]',
    setup: 'bg-purple-50 border-purple-200 text-purple-700',
    free: 'bg-gray-50 border-gray-200 text-gray-600',
};

// ========================================================================================
// Props
// ========================================================================================

interface SmartPlanTimelineProProps {
    plan: ProTimelinePlan;
    accommodationCoord: { lat: number; lng: number };
    onPlanUpdate: (updatedPlan: ProTimelinePlan) => void;
}

// ========================================================================================
// Component
// ========================================================================================

export default function SmartPlanTimelinePro({ plan, accommodationCoord, onPlanUpdate }: SmartPlanTimelineProProps) {
    const [expandedDay, setExpandedDay] = useState<number>(1);
    const [navTargetBlock, setNavTargetBlock] = useState<TimelineBlock | null>(null);
    const [swapBlock, setSwapBlock] = useState<TimelineBlock | null>(null);
    const [editTimeBlock, setEditTimeBlock] = useState<TimelineBlock | null>(null);
    const [editHour, setEditHour] = useState(9);
    const [editMin, setEditMin] = useState(0);

    // ========================================================================================
    // Core Actions
    // ========================================================================================

    /** 범용 재계산 → plan 업데이트 */
    const updateDayBlocks = useCallback((dayNum: number, updatedBlocks: TimelineBlock[]) => {
        const newDays = plan.days.map(d =>
            d.day === dayNum ? { ...d, blocks: updatedBlocks } : d
        );
        onPlanUpdate({ ...plan, days: newDays });
    }, [plan, onPlanUpdate]);

    /** "~로 출발" 버튼 클릭 */
    const handleDepartTo = useCallback((block: TimelineBlock, dayNum: number) => {
        if (!block.factCard) return;

        // 1. 현재 시각 적용
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        // 2. 재계산
        const dayData = plan.days.find(d => d.day === dayNum);
        if (!dayData) return;
        const blockIndex = dayData.blocks.findIndex(b => b.id === block.id);
        if (blockIndex < 0) return;

        const recalced = recalcTimelineFrom(dayData.blocks, blockIndex, currentTime);
        updateDayBlocks(dayNum, recalced);
        toast.success(`${currentTime} 기준으로 일정이 재조정되었습니다`);

        // 3. 내비 선택 시트 열기
        setNavTargetBlock(block);
    }, [plan, updateDayBlocks]);

    /** 장소 숨기기 */
    const handleHideBlock = useCallback((block: TimelineBlock, dayNum: number) => {
        const dayData = plan.days.find(d => d.day === dayNum);
        if (!dayData) return;
        const blockIndex = dayData.blocks.findIndex(b => b.id === block.id);
        if (blockIndex < 0) return;

        const updated = dayData.blocks.map((b, i) =>
            i === blockIndex ? { ...b, hidden: true } : b
        );

        // 숨긴 블록 다음부터 재계산
        const nextVisible = updated.findIndex((b, i) => i > blockIndex && !b.hidden);
        if (nextVisible >= 0 && blockIndex > 0) {
            const prevBlock = updated.slice(0, blockIndex).reverse().find(b => !b.hidden);
            const baseTime = prevBlock?.endTime || '09:00';
            const baseCoord = prevBlock?.factCard
                ? { lat: prevBlock.factCard.lat, lng: prevBlock.factCard.lng }
                : accommodationCoord;
            const recalced = recalcTimelineFrom(updated, nextVisible, baseTime, baseCoord);
            updateDayBlocks(dayNum, recalced);
        } else {
            updateDayBlocks(dayNum, updated);
        }
        toast('일정에서 제외했습니다', { icon: '👁️‍🗨️' });
    }, [plan, accommodationCoord, updateDayBlocks]);

    /** 장소 교체 (Swap) */
    const handleSwap = useCallback((block: TimelineBlock, newCard: FactCard, dayNum: number) => {
        const dayData = plan.days.find(d => d.day === dayNum);
        if (!dayData) return;
        const blockIndex = dayData.blocks.findIndex(b => b.id === block.id);
        if (blockIndex < 0) return;

        const updated = dayData.blocks.map((b, i) =>
            i === blockIndex ? {
                ...b,
                title: newCard.name,
                location_id: newCard.id,
                factCard: newCard,
                phone: newCard.metadata?.phone || newCard.metadata?.tel,
                description: newCard.reasoning || newCard.description,
            } : b
        );

        // 좌표 변경 → 재계산
        const prevBlock = updated.slice(0, blockIndex).reverse().find(b => !b.hidden);
        const baseTime = updated[blockIndex].time;
        const baseCoord = prevBlock?.factCard
            ? { lat: prevBlock.factCard.lat, lng: prevBlock.factCard.lng }
            : accommodationCoord;
        const recalced = recalcTimelineFrom(updated, blockIndex, baseTime, baseCoord);
        updateDayBlocks(dayNum, recalced);
        setSwapBlock(null);
        toast.success(`${newCard.name}(으)로 변경되었습니다`);
    }, [plan, accommodationCoord, updateDayBlocks]);

    /** 시간 편집 적용 */
    const handleTimeEdit = useCallback(() => {
        if (!editTimeBlock) return;
        const newTime = `${editHour.toString().padStart(2, '0')}:${editMin.toString().padStart(2, '0')}`;
        const dayNum = editTimeBlock.day;
        const dayData = plan.days.find(d => d.day === dayNum);
        if (!dayData) return;
        const blockIndex = dayData.blocks.findIndex(b => b.id === editTimeBlock.id);
        if (blockIndex < 0) return;

        const recalced = recalcTimelineFrom(dayData.blocks, blockIndex, newTime);
        updateDayBlocks(dayNum, recalced);
        setEditTimeBlock(null);
        toast.success(`${newTime}부터 일정이 재조정되었습니다`);
    }, [editTimeBlock, editHour, editMin, plan, updateDayBlocks]);

    /** 내비 실행 */
    const handleNavChoice = useCallback((app: 'kakao' | 'tmap' | 'naver' | 'kakaonavi') => {
        if (!navTargetBlock?.factCard) return;
        const fc = navTargetBlock.factCard;
        openNavApp(app, {
            origin: { name: '현재 위치', lat: 0, lng: 0 }, // 출발지 생략 → 내비가 GPS 사용
            destination: { name: fc.name, lat: fc.lat, lng: fc.lng },
        });
        setNavTargetBlock(null);
    }, [navTargetBlock]);

    // ========================================================================================
    // Render
    // ========================================================================================

    return (
        <div className="flex flex-col gap-0">
            {/* Header */}
            <div className="text-center mb-4">
                <p className="text-xs font-bold text-[#224732]/60 tracking-wider uppercase">
                    ⚡ LIVE Timeline
                </p>
                {plan.narration && (
                    <p className="text-xs text-gray-500 mt-2 px-4 leading-relaxed">
                        {plan.narration.slice(0, 120)}...
                    </p>
                )}
            </div>

            {/* Day Sections */}
            {plan.days.map((dayData) => (
                <div key={dayData.day} className="mb-3">
                    {/* Day Header */}
                    <button
                        onClick={() => setExpandedDay(expandedDay === dayData.day ? 0 : dayData.day)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-[#224732] rounded-xl text-white"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-black">Day {dayData.day}</span>
                            <span className="text-xs opacity-80">{dayData.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] opacity-60">{dayData.date}</span>
                            {expandedDay === dayData.day
                                ? <ChevronUp className="w-4 h-4 opacity-60" />
                                : <ChevronDown className="w-4 h-4 opacity-60" />
                            }
                        </div>
                    </button>

                    {/* Timeline Blocks */}
                    <AnimatePresence>
                        {expandedDay === dayData.day && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="overflow-hidden"
                            >
                                <div className="relative ml-6 border-l-2 border-dashed border-[#224732]/15 pl-5 pt-3 pb-2">
                                    {dayData.blocks.filter(b => !b.hidden).map((block, idx) => (
                                        <div key={block.id} className="relative mb-4">
                                            {/* Timeline Dot */}
                                            <div className="absolute -left-[27px] top-3 w-3 h-3 rounded-full bg-[#224732] border-2 border-white shadow-sm" />

                                            {/* Travel Indicator */}
                                            {block.travel_mins > 0 && idx > 0 && (
                                                <div className="flex items-center gap-1.5 mb-2 -ml-1">
                                                    <span className="text-[10px] text-gray-400">🚗 이동 {block.travel_mins}분</span>
                                                    <div className="flex-1 h-px bg-gray-100" />
                                                </div>
                                            )}

                                            {/* Block Card */}
                                            {block.type === 'move' || block.type === 'rest' ? (
                                                /* 이동/도착/출발 블록 (간단) */
                                                <div className="flex items-center gap-2 py-1.5">
                                                    <button
                                                        onClick={() => {
                                                            setEditHour(parseInt(block.time.split(':')[0]));
                                                            setEditMin(parseInt(block.time.split(':')[1]));
                                                            setEditTimeBlock(block);
                                                        }}
                                                        className="text-xs font-mono font-bold text-gray-400 hover:text-[#224732] transition-colors min-w-[40px]"
                                                    >
                                                        {block.time}
                                                    </button>
                                                    <span className="text-sm">{BLOCK_ICONS[block.type]}</span>
                                                    <span className="text-sm font-bold text-gray-600">{block.title}</span>
                                                </div>
                                            ) : (
                                                /* 장소 블록 (상세 카드) */
                                                <div className={`rounded-xl border p-3 ${BLOCK_COLORS[block.type]}`}>
                                                    {/* Time + Title */}
                                                    <div className="flex items-start justify-between mb-1.5">
                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            <button
                                                                onClick={() => {
                                                                    setEditHour(parseInt(block.time.split(':')[0]));
                                                                    setEditMin(parseInt(block.time.split(':')[1]));
                                                                    setEditTimeBlock(block);
                                                                }}
                                                                className="text-xs font-mono font-bold opacity-70 hover:opacity-100 transition-opacity flex-shrink-0"
                                                            >
                                                                {block.time}~{block.endTime}
                                                            </button>
                                                            <span className="text-sm">{BLOCK_ICONS[block.type]}</span>
                                                        </div>
                                                        <span className="text-[10px] font-bold opacity-50">{block.duration_mins}분</span>
                                                    </div>

                                                    {/* Place Name */}
                                                    <h4 className="text-sm font-black truncate">{block.title}</h4>

                                                    {/* Description */}
                                                    {block.description && (
                                                        <p className="text-[11px] opacity-70 mt-0.5 line-clamp-1">{block.description}</p>
                                                    )}

                                                    {/* Badges */}
                                                    {block.factCard?.evidence?.displayBadges && block.factCard.evidence.displayBadges.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                            {block.factCard.evidence.displayBadges.slice(0, 3).map((badge, i) => (
                                                                <span key={i} className="text-[9px] font-bold bg-white/60 px-1.5 py-0.5 rounded-full">
                                                                    {badge.emoji} {badge.label}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Action Buttons */}
                                                    <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-current/10">
                                                        {/* "~로 출발" 버튼 */}
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleDepartTo(block, dayData.day)}
                                                            className="flex-1 h-9 bg-[#224732] hover:bg-[#1a3626] text-white text-xs font-bold rounded-lg shadow-sm active:scale-95 transition-all"
                                                        >
                                                            <Navigation className="w-3 h-3 mr-1" />
                                                            {block.title.length > 6 ? block.title.slice(0, 6) + '…' : block.title}으로 출발
                                                        </Button>

                                                        {/* 교체 */}
                                                        <button
                                                            onClick={() => setSwapBlock(block)}
                                                            className="flex items-center gap-0.5 px-2.5 h-9 rounded-lg bg-white/50 hover:bg-white/80 text-xs font-bold transition-all"
                                                        >
                                                            <ArrowRightLeft className="w-3 h-3" />
                                                            교체
                                                        </button>

                                                        {/* 숨기기 */}
                                                        <button
                                                            onClick={() => handleHideBlock(block, dayData.day)}
                                                            className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/50 hover:bg-red-50 text-gray-400 hover:text-red-400 transition-all"
                                                        >
                                                            <EyeOff className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            ))}

            {/* ============================================================ */}
            {/* 캠핑 모드 체류 카드 리스트 */}
            {/* ============================================================ */}
            {plan.travelType === 'camping' && plan.campingCards && (
                <div className="mt-4 px-1">
                    <h4 className="text-sm font-black text-gray-900 mb-3">📌 캠핑장 주변 알아두면 좋은 곳</h4>
                    {Object.entries(plan.campingCards).map(([catKey, cards]) => {
                        if (cards.length === 0) return null;
                        const catLabels: Record<string, string> = {
                            mart: '🛒 마트/편의',
                            spot: '🏞️ 주변 명소',
                            restaurant: '🍽️ 인근 맛집',
                            gas: '⛽ 주유/등유',
                        };
                        return (
                            <div key={catKey} className="mb-3">
                                <p className="text-xs font-bold text-gray-500 mb-1.5">{catLabels[catKey] || catKey}</p>
                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                    {cards.slice(0, 5).map(card => (
                                        <div key={card.id} className="flex-shrink-0 w-36 p-2.5 bg-white rounded-xl border border-gray-100 shadow-sm">
                                            <p className="text-xs font-bold text-gray-900 truncate">{card.name}</p>
                                            <p className="text-[10px] text-gray-400 mt-0.5 truncate">{card.description}</p>
                                            {card.distanceKm && (
                                                <p className="text-[10px] text-[#224732] font-bold mt-1">
                                                    <MapPin className="w-2.5 h-2.5 inline mr-0.5" />{card.distanceKm.toFixed(1)}km
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ============================================================ */}
            {/* 내비 선택 Sheet */}
            {/* ============================================================ */}
            <Sheet open={!!navTargetBlock} onOpenChange={() => setNavTargetBlock(null)}>
                <SheetContent side="bottom" className="rounded-t-3xl pb-8">
                    <SheetHeader>
                        <SheetTitle className="text-base font-black">내비게이션 선택</SheetTitle>
                        <SheetDescription className="text-xs text-gray-400">
                            {navTargetBlock?.title}(으)로 안내를 시작합니다
                        </SheetDescription>
                    </SheetHeader>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        {[
                            { key: 'kakao' as const, label: '카카오맵', emoji: '🗺️' },
                            { key: 'tmap' as const, label: 'T맵', emoji: '🚗' },
                            { key: 'naver' as const, label: '네이버 지도', emoji: '🧭' },
                            { key: 'kakaonavi' as const, label: '카카오내비', emoji: '📍' },
                        ].map(nav => (
                            <button
                                key={nav.key}
                                onClick={() => handleNavChoice(nav.key)}
                                className="flex items-center gap-2 p-4 rounded-xl border border-gray-100 hover:border-[#224732]/30 hover:bg-[#224732]/5 transition-all active:scale-95"
                            >
                                <span className="text-xl">{nav.emoji}</span>
                                <span className="text-sm font-bold text-gray-900">{nav.label}</span>
                            </button>
                        ))}
                    </div>
                </SheetContent>
            </Sheet>

            {/* ============================================================ */}
            {/* 시간 편집 Sheet */}
            {/* ============================================================ */}
            <Sheet open={!!editTimeBlock} onOpenChange={() => setEditTimeBlock(null)}>
                <SheetContent side="bottom" className="rounded-t-3xl pb-8">
                    <SheetHeader>
                        <SheetTitle className="text-base font-black">시간 변경</SheetTitle>
                        <SheetDescription className="text-xs text-gray-400">
                            이후 일정의 시간이 자동으로 재조정됩니다
                        </SheetDescription>
                    </SheetHeader>
                    <div className="flex items-center justify-center gap-4 mt-6 mb-6">
                        <div className="flex flex-col items-center">
                            <button onClick={() => setEditHour(h => Math.min(23, h + 1))} className="p-2 text-gray-400 hover:text-gray-700">
                                <ChevronUp className="w-6 h-6" />
                            </button>
                            <span className="text-4xl font-black text-[#224732] w-16 text-center">{editHour.toString().padStart(2, '0')}</span>
                            <button onClick={() => setEditHour(h => Math.max(0, h - 1))} className="p-2 text-gray-400 hover:text-gray-700">
                                <ChevronDown className="w-6 h-6" />
                            </button>
                        </div>
                        <span className="text-3xl font-black text-gray-300">:</span>
                        <div className="flex flex-col items-center">
                            <button onClick={() => setEditMin(m => (m + 10) % 60)} className="p-2 text-gray-400 hover:text-gray-700">
                                <ChevronUp className="w-6 h-6" />
                            </button>
                            <span className="text-4xl font-black text-[#224732] w-16 text-center">{editMin.toString().padStart(2, '0')}</span>
                            <button onClick={() => setEditMin(m => (m - 10 + 60) % 60)} className="p-2 text-gray-400 hover:text-gray-700">
                                <ChevronDown className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                    <Button
                        onClick={handleTimeEdit}
                        className="w-full h-12 bg-[#224732] hover:bg-[#1a3626] text-white font-bold rounded-xl active:scale-[0.98]"
                    >
                        이 시간으로 변경
                    </Button>
                </SheetContent>
            </Sheet>

            {/* ============================================================ */}
            {/* 교체(Swap) Sheet */}
            {/* ============================================================ */}
            <Sheet open={!!swapBlock} onOpenChange={() => setSwapBlock(null)}>
                <SheetContent side="bottom" className="rounded-t-3xl pb-8 max-h-[70vh] overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle className="text-base font-black">장소 교체</SheetTitle>
                        <SheetDescription className="text-xs text-gray-400">
                            {swapBlock?.title} 대신 방문할 곳을 선택하세요
                        </SheetDescription>
                    </SheetHeader>
                    <div className="flex flex-col gap-2 mt-4">
                        {(() => {
                            if (!swapBlock?.factCard) return <p className="text-xs text-gray-400 text-center py-8">교체 가능한 장소가 없습니다</p>;
                            const cat = swapBlock.factCard.category;
                            const alts = plan.alternatives[cat] || [];
                            if (alts.length === 0) return <p className="text-xs text-gray-400 text-center py-8">교체 가능한 장소가 없습니다</p>;
                            return alts.slice(0, 10).map(card => (
                                <button
                                    key={card.id}
                                    onClick={() => handleSwap(swapBlock, card, swapBlock.day)}
                                    className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-[#224732]/30 hover:bg-[#224732]/5 transition-all active:scale-[0.98]"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 truncate">{card.name}</p>
                                            <p className="text-[10px] text-gray-400 mt-0.5 truncate">{card.reasoning || card.description}</p>
                                        </div>
                                        {card.evidence?.stars && (
                                            <span className="text-[10px] font-bold text-yellow-600 flex-shrink-0 ml-2">
                                                ⭐ {card.evidence.stars}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            ));
                        })()}
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
