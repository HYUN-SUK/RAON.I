'use client';

import React, { useMemo } from 'react';
import { DayPicker, DateRange } from 'react-day-picker';
import { ko } from 'date-fns/locale';
import { format } from 'date-fns';
import { useReservationStore } from '@/store/useReservationStore';
import { Calendar as CalendarIcon, RefreshCw } from 'lucide-react';
import { checkReservationRules, D_N_DAYS } from '@/utils/reservationRules';
import { SITES } from '@/constants/sites';
import { OPEN_DAY_CONFIG } from '@/constants/reservation';
import 'react-day-picker/style.css';
import { cn } from '@/lib/utils';

export default function DateRangePicker() {
    const { selectedDateRange, setDateRange, reservations, openDayRule, fetchHolidays, holidays } = useReservationStore();

    const activeConfig = useMemo(() => {
        if (openDayRule) {
            return {
                seasonName: openDayRule.seasonName || 'New Season',
                openAt: openDayRule.openAt,
                closeAt: openDayRule.closeAt,
            };
        }
        return OPEN_DAY_CONFIG;
    }, [openDayRule]);

    // Ensure dates are Date objects
    const selected = {
        from: selectedDateRange.from ? new Date(selectedDateRange.from) : undefined,
        to: selectedDateRange.to ? new Date(selectedDateRange.to) : undefined,
    };

    const handleSelect = (range: DateRange | undefined) => {
        setDateRange({ from: range?.from, to: range?.to });
    };

    React.useEffect(() => {
        fetchHolidays();
    }, [fetchHolidays]);

    const isDateHoliday = (date: Date) => {
        const isSunday = date.getDay() === 0;
        if (isSunday) return true;

        if (!holidays || !(holidays instanceof Set)) return false;
        return holidays.has(format(date, 'yyyy-MM-dd'));
    };

    const now = new Date();

    // Calculate End-cap conditions (Duplicated logic from page, ideally centralized or context, but OK here for UI feedback)
    let isSaturdayFull = false;
    let isNextDayBlocked = false;

    if (selected.from) {
        const checkIn = new Date(selected.from);
        const nextDay = new Date(checkIn);
        nextDay.setDate(checkIn.getDate() + 1);

        if (nextDay > activeConfig.closeAt) {
            isNextDayBlocked = true;
        }

        if (checkIn.getDay() === 5) { // Friday
            const nextDayStr = nextDay.toISOString().split('T')[0];

            const saturdayBookedSiteIds = reservations
                .filter(r => {
                    const rCheckIn = new Date(r.checkInDate);
                    const rCheckOut = new Date(r.checkOutDate);
                    return rCheckIn <= nextDay && rCheckOut > nextDay && r.status !== 'CANCELLED';
                })
                .map(r => r.siteId);

            const fridayBookedSiteIds = reservations
                .filter(r => {
                    const rCheckIn = new Date(r.checkInDate);
                    const rCheckOut = new Date(r.checkOutDate);
                    return rCheckIn <= checkIn && rCheckOut > checkIn && r.status !== 'CANCELLED';
                })
                .map(r => r.siteId);

            const hasEndCapCandidate = SITES.some(site =>
                !fridayBookedSiteIds.includes(site.id) &&
                saturdayBookedSiteIds.includes(site.id)
            );

            if (hasEndCapCandidate) {
                isSaturdayFull = true;
            }
        }
    }

    const { isFridayOneNight, isWithinDN, isEndCap } = checkReservationRules(selected.from, selected.to, now, { isSaturdayFull, isNextDayBlocked });



    return (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-stone-100">
                <div className="flex items-center gap-2 text-stone-700">
                    <CalendarIcon className="w-5 h-5 text-[#2F5233]" />
                    <span className="font-medium">일정 선택</span>
                </div>
                <button
                    onClick={() => setDateRange({ from: undefined, to: undefined })}
                    className="text-xs text-stone-400 hover:text-[#1C4526] flex items-center gap-1 px-2 py-1 rounded-md hover:bg-stone-50 transition-colors"
                >
                    <RefreshCw className="w-3 h-3" />
                    초기화
                </button>
            </div>

            <style>
                {`
                    .rdp { margin: 0; }
                    .rdp-day_selected, .rdp-day_selected:hover { 
                        background-color: #1C4526 !important; 
                        color: white !important;
                    }
                    .rdp-day_today { 
                        font-weight: bold; 
                        color: #1C4526;
                    }
                    .rdp-button:hover:not([disabled]):not(.rdp-day_selected) { 
                        background-color: #F7F5EF !important;
                        color: #1C4526 !important;
                    }
                    .rdp-day_holiday {
                        color: #ef4444 !important;
                        font-weight: bold;
                    }
                `}
            </style>




            <DayPicker
                mode="range"
                selected={selected}
                onSelect={handleSelect}
                locale={ko}
                numberOfMonths={1}
                showOutsideDays
                disabled={[
                    { before: now },
                    { before: activeConfig.openAt },
                    { after: activeConfig.closeAt }
                ]}
                modifiers={{ holiday: isDateHoliday }}
                modifiersClassNames={{ holiday: "!text-red-500 !font-bold" }}
                footer={
                    <div className="mt-4 space-y-2 text-center">
                        {isFridayOneNight && (
                            isWithinDN ? (
                                <p className="text-xs text-brand-1 font-bold animate-pulse p-2 bg-brand-1/5 rounded-lg">
                                    ✅ 임박 예약(D-{D_N_DAYS})으로 주말 1박 가능!
                                </p>
                            ) : isEndCap ? (
                                <p className="text-xs text-blue-600 font-bold animate-pulse p-2 bg-blue-50 rounded-lg">
                                    ✅ 잔여석(End-Cap) 찬스로 1박 가능!
                                </p>
                            ) : (
                                <div className="p-2 bg-red-50 border border-red-100 rounded-lg">
                                    <p className="text-xs text-red-500 font-bold leading-relaxed break-keep">
                                        주말예약(금,토,일)은 2박부터 가능합니다. 다만 토요일이 예약된 사이트는 금요일 1박도 가능합니다.
                                    </p>
                                </div>
                            )
                        )}
                        {!isFridayOneNight && (
                            <p className="text-[10px] text-stone-400">
                                * {activeConfig.seasonName} (~{format(activeConfig.closeAt, 'MM.dd')})
                            </p>
                        )}
                    </div>
                }
                className="mx-auto"
                classNames={{
                    months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 justify-center",
                    month: "space-y-4",
                    caption: "flex justify-center pt-1 relative items-center text-stone-800",
                    caption_label: "text-sm font-bold",
                    nav: "space-x-1 flex items-center",
                    nav_button: "h-7 w-7 bg-transparent hover:bg-stone-100 rounded-full flex items-center justify-center transition-colors text-stone-600",
                    table: "w-full border-collapse space-y-1",
                    head_row: "flex justify-center",
                    head_cell: "text-stone-400 rounded-md w-9 font-normal text-[0.8rem]",
                    row: "flex w-full mt-2 justify-center",
                    cell: "text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                    day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-full transition-colors text-stone-700",
                    day_outside: "text-stone-300 opacity-50",
                    day_disabled: "text-stone-200 opacity-30",
                    day_range_middle: "aria-selected:bg-[#1C4526]/10 aria-selected:text-[#1C4526]",
                    day_hidden: "invisible",
                }}
            />

            <div className="mt-4 p-3 bg-stone-50 rounded-xl text-sm text-stone-600 flex justify-between items-center border border-stone-100">
                <div className="text-center w-1/2">
                    <p className="text-[10px] text-stone-400 mb-0.5">체크인</p>
                    <p className="font-semibold text-[#1C4526]">
                        {selected.from ? format(selected.from, 'yyyy.MM.dd') : '-'}
                    </p>
                </div>
                <div className="h-8 w-[1px] bg-stone-200"></div>
                <div className="text-center w-1/2">
                    <p className="text-[10px] text-stone-400 mb-0.5">체크아웃</p>
                    <p className="font-semibold text-[#1C4526]">
                        {selected.to ? format(selected.to, 'yyyy.MM.dd') : '-'}
                    </p>
                </div>
            </div>
        </div>
    );
}
