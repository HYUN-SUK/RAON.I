'use client';

import * as React from 'react';
import { DayPicker, DateRange } from 'react-day-picker';
import { ko } from 'date-fns/locale';
import { format } from 'date-fns';
import { useReservationStore } from '@/store/useReservationStore';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { checkReservationRules, D_N_DAYS } from '@/utils/reservationRules';
import 'react-day-picker/style.css';

export default function DateRangePicker() {
    const { selectedDateRange, setDateRange } = useReservationStore();

    // Ensure dates are Date objects (handle hydration from string)
    const selected = {
        from: selectedDateRange.from ? new Date(selectedDateRange.from) : undefined,
        to: selectedDateRange.to ? new Date(selectedDateRange.to) : undefined,
    };

    const handleSelect = (range: DateRange | undefined) => {
        setDateRange({ from: range?.from, to: range?.to });
    };

    // Mock Open Day Rule (SSOT 5.10)
    const OPEN_DAY_RULE = {
        openAt: new Date('2024-01-01T09:00:00'), // Already opened
        closeAt: new Date('2025-12-31T23:59:59'),
        seasonName: "2024-2025 시즌"
    };

    const now = new Date();
    const isOpen = now >= OPEN_DAY_RULE.openAt;

    // Strict Weekend Rule & D-N Exception (SSOT 6.2.1)
    // Use centralized utility
    const { isFridayOneNight, isWithinDN } = checkReservationRules(selected.from, selected.to, now);

    return (
        <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl relative overflow-hidden">
            {/* Open Day Banner (SSOT 5.10.3) */}
            {!isOpen && (
                <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center text-center p-4">
                    <p className="text-yellow-400 font-bold text-lg mb-2">🔒 예약 오픈 예정</p>
                    <p className="text-white text-sm mb-4">
                        다음 시즌 오픈일: {format(OPEN_DAY_RULE.openAt, 'yyyy.MM.dd HH:mm')}
                    </p>
                    <p className="text-white/50 text-xs">
                        * 현재는 예약이 불가능합니다.
                    </p>
                </div>
            )}

            <div className="flex items-center justify-between mb-4 text-white/90">
                <div className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-[#2F5233]" />
                    <span className="font-medium text-lg">날짜 선택</span>
                </div>
                <button
                    onClick={() => setDateRange({ from: undefined, to: undefined })}
                    className="text-xs text-white/50 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10"
                >
                    초기화
                </button>
            </div>

            <DayPicker
                mode="range"
                selected={selected}
                onSelect={handleSelect}
                locale={ko}
                numberOfMonths={1}
                showOutsideDays
                disabled={[
                    { before: new Date() },
                    { before: OPEN_DAY_RULE.openAt }, // Disable before open
                    { after: OPEN_DAY_RULE.closeAt }  // Disable after close
                ]}
                footer={
                    <div className="mt-4 space-y-2 text-center">
                        {isFridayOneNight && (
                            isWithinDN ? (
                                <p className="text-xs text-green-400 font-bold animate-pulse">
                                    ✅ 임박 예약(D-{D_N_DAYS})으로 금요일 1박 예약이 가능합니다!
                                </p>
                            ) : (
                                <div className="p-2 bg-red-500/20 border border-red-500/50 rounded-lg">
                                    <p className="text-xs text-red-400 font-bold mb-1">
                                        ⛔ 주말(금요일)은 2박 이상만 예약 가능합니다.
                                    </p>
                                    <p className="text-[10px] text-white/60">
                                        * 2박 이상 선택 시 사이트 목록이 활성화됩니다.
                                    </p>
                                </div>
                            )
                        )}
                        {!isFridayOneNight && (
                            <p className="text-[10px] text-white/40">
                                * 예약 가능 기간: ~ {format(OPEN_DAY_RULE.closeAt, 'yyyy.MM.dd')}
                            </p>
                        )}
                    </div>
                }
                className="text-white mx-auto"
                classNames={{
                    months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 justify-center",
                    month: "space-y-4",
                    caption: "flex justify-center pt-1 relative items-center",
                    caption_label: "text-sm font-medium",
                    nav: "space-x-1 flex items-center",
                    nav_button: "h-7 w-7 bg-transparent hover:bg-white/10 rounded-full flex items-center justify-center transition-colors text-white",
                    nav_button_previous: "absolute left-1",
                    nav_button_next: "absolute right-1",
                    table: "w-full border-collapse space-y-1",
                    head_row: "flex justify-center",
                    head_cell: "text-white/60 rounded-md w-9 font-normal text-[0.8rem]",
                    row: "flex w-full mt-2 justify-center",
                    cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-white/5 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                    day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-white/10 rounded-full transition-colors text-white",
                    day_selected: "bg-[#2F5233] text-white hover:bg-[#2F5233] hover:text-white focus:bg-[#2F5233] focus:text-white",
                    day_today: "bg-white/20 text-white",
                    day_outside: "text-white/30 opacity-50",
                    day_disabled: "text-white/30 opacity-50",
                    day_range_middle: "aria-selected:bg-white/10 aria-selected:text-white",
                    day_hidden: "invisible",
                }}
            />

            <div className="mt-4 p-3 bg-black/20 rounded-xl text-sm text-white/80 flex justify-between items-center">
                <div>
                    <p className="text-xs text-white/50">체크인</p>
                    <p>{selected.from ? format(selected.from, 'yyyy.MM.dd') : '-'}</p>
                </div>
                <div className="h-8 w-[1px] bg-white/10"></div>
                <div className="text-right">
                    <p className="text-xs text-white/50">체크아웃</p>
                    <p>{selected.to ? format(selected.to, 'yyyy.MM.dd') : '-'}</p>
                </div>
            </div>
        </div>
    );
}
