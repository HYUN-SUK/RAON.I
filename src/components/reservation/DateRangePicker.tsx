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

    // Calculate End-cap & Start-cap conditions (Duplicated logic from page, ideally centralized or context, but OK here for UI feedback)
    let isSaturdayFull = false;
    let isNextDayBlocked = false;
    let isFridayFull = false;
    let isPrevDayBlocked = false;

    if (selected.from) {
        const checkIn = new Date(selected.from);
        
        const prevDay = new Date(checkIn);
        prevDay.setDate(checkIn.getDate() - 1);

        const nextDay = new Date(checkIn);
        nextDay.setDate(checkIn.getDate() + 1);

        if (prevDay < activeConfig.openAt) {
            isPrevDayBlocked = true;
        }

        if (nextDay > activeConfig.closeAt) {
            isNextDayBlocked = true;
        }

        if (checkIn.getDay() === 5) { // Friday
            const saturdayBookedSiteIds = reservations
                .filter(r => {
                    const rCheckIn = new Date(r.checkInDate);
                    const rCheckOut = new Date(r.checkOutDate);
                    return rCheckIn <= nextDay && rCheckOut > nextDay && r.status !== 'CANCELLED' && r.status !== 'REFUNDED' && r.status !== 'REFUND_PENDING';
                })
                .map(r => r.siteId);

            const fridayBookedSiteIds = reservations
                .filter(r => {
                    const rCheckIn = new Date(r.checkInDate);
                    const rCheckOut = new Date(r.checkOutDate);
                    return rCheckIn <= checkIn && rCheckOut > checkIn && r.status !== 'CANCELLED' && r.status !== 'REFUNDED' && r.status !== 'REFUND_PENDING';
                })
                .map(r => r.siteId);

            const hasEndCapCandidate = SITES.some(site =>
                !fridayBookedSiteIds.includes(site.id) &&
                saturdayBookedSiteIds.includes(site.id)
            );

            if (hasEndCapCandidate) {
                isSaturdayFull = true;
            }
        } else if (checkIn.getDay() === 6) { // Saturday (Start-cap)
            const fridayBookedSiteIds = reservations
                .filter(r => {
                    const rCheckIn = new Date(r.checkInDate);
                    const rCheckOut = new Date(r.checkOutDate);
                    return rCheckIn <= prevDay && rCheckOut > prevDay && r.status !== 'CANCELLED' && r.status !== 'REFUNDED' && r.status !== 'REFUND_PENDING';
                })
                .map(r => r.siteId);

            const saturdayBookedSiteIds = reservations
                .filter(r => {
                    const rCheckIn = new Date(r.checkInDate);
                    const rCheckOut = new Date(r.checkOutDate);
                    return rCheckIn <= checkIn && rCheckOut > checkIn && r.status !== 'CANCELLED' && r.status !== 'REFUNDED' && r.status !== 'REFUND_PENDING';
                })
                .map(r => r.siteId);

            const hasStartCapCandidate = SITES.some(site =>
                fridayBookedSiteIds.includes(site.id) &&
                !saturdayBookedSiteIds.includes(site.id)
            );

            if (hasStartCapCandidate) {
                isFridayFull = true;
            }
        }
    }

    const { isFridayOneNight, isWithinDN, isEndCap, isStartCap } = checkReservationRules(selected.from, selected.to, now, { 
        isSaturdayFull, 
        isNextDayBlocked,
        isFridayFull,
        isPrevDayBlocked
    });



    return (
        <div className="bg-white rounded-3xl border border-[#EAEFEA] shadow-xs p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#F0F4F1]">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#E8F2EA] flex items-center justify-center">
                        <CalendarIcon className="w-4 h-4 text-[#2E7D47]" />
                    </div>
                    <span className="font-black text-base text-[#1E4D2B]">일정 선택</span>
                </div>
                <button
                    onClick={() => setDateRange({ from: undefined, to: undefined })}
                    className="text-xs font-bold text-[#556B5C] bg-[#EFF3F0] hover:bg-[#E2EAE4] transition-colors px-3 py-1.5 rounded-full flex items-center gap-1.5"
                >
                    <RefreshCw className="w-3 h-3 text-[#556B5C]" />
                    초기화
                </button>
            </div>

            <style>
                {`
                    .rdp { margin: 0; }
                    .rdp-day_selected, .rdp-day_selected:hover { 
                        background-color: #2E7D47 !important; 
                        color: #ffffff !important;
                        font-weight: 700 !important;
                    }
                    .rdp-day_today { 
                        font-weight: 800; 
                        color: #1E4D2B;
                    }
                    .rdp-button:hover:not([disabled]):not(.rdp-day_selected) { 
                        background-color: #E8F2EA !important;
                        color: #1E4D2B !important;
                    }
                    .rdp-day_holiday {
                        color: #E06B62 !important;
                        font-weight: 700;
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
                modifiersClassNames={{ holiday: "!text-[#E06B62] !font-bold" }}
                footer={
                    <div className="mt-4 space-y-2 text-center">
                        {isFridayOneNight && (
                            isWithinDN ? (
                                <p className="text-xs text-[#1E4D2B] font-bold animate-pulse p-2.5 bg-[#E8F2EA] border border-[#68A678]/40 rounded-xl">
                                    ✅ 임박 예약(D-{D_N_DAYS})으로 주말 1박 가능!
                                </p>
                            ) : (isEndCap || isStartCap) ? (
                                <p className="text-xs text-[#1E4D2B] font-bold animate-pulse p-2.5 bg-[#E8F2EA] border border-[#68A678]/40 rounded-xl">
                                    ✅ 잔여석(자투리) 찬스로 1박 가능!
                                </p>
                            ) : (
                                <div className="p-2.5 bg-[#FFF5F5] border border-[#FAD2D2] rounded-xl">
                                    <p className="text-xs text-[#E06B62] font-bold leading-relaxed break-keep">
                                        주말예약(금,토,일)은 2박부터 가능합니다. 다만 토요일이 예약된 사이트는 금요일 1박이 가능하며, 금요일이 예약된 사이트는 토요일 1박도 가능합니다.
                                    </p>
                                </div>
                            )
                        )}
                        {!isFridayOneNight && (
                            <p className="text-[11px] text-[#7A8B7E] font-medium">
                                * {activeConfig.seasonName} (~{format(activeConfig.closeAt, 'MM.dd')})
                            </p>
                        )}
                    </div>
                }
                className="mx-auto"
                classNames={{
                    months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 justify-center",
                    month: "space-y-4",
                    caption: "flex justify-center pt-1 pb-2 relative items-center text-[#1E4D2B]",
                    caption_label: "text-base font-black text-[#1E4D2B]",
                    nav: "space-x-1 flex items-center",
                    nav_button: "h-8 w-8 bg-[#E8F2EA] hover:bg-[#DDF0E4] rounded-xl flex items-center justify-center transition-colors text-[#2E7D47]",
                    table: "w-full border-collapse space-y-1",
                    head_row: "flex justify-center",
                    head_cell: "text-[#7A8B7E] rounded-md w-9 font-bold text-xs",
                    row: "flex w-full mt-2 justify-center",
                    cell: "text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                    day: "h-9 w-9 p-0 font-bold aria-selected:opacity-100 rounded-full transition-colors text-[#112918]",
                    day_outside: "text-[#C2CDC5] opacity-60 font-normal",
                    day_disabled: "text-[#D5DDD6] opacity-40 font-normal",
                    day_range_middle: "aria-selected:bg-[#E8F2EA] aria-selected:text-[#1E4D2B]",
                    day_hidden: "invisible",
                }}
            />

            <div className="mt-4 p-4 bg-[#F8FAF8] rounded-2xl text-sm flex justify-between items-center border border-[#E8EEE9]">
                <div className="text-center w-1/2">
                    <p className="text-xs text-[#7A8B7E] font-medium mb-1">체크인</p>
                    <p className="font-black text-lg text-[#1E4D2B]">
                        {selected.from ? format(selected.from, 'yyyy.MM.dd') : '-'}
                    </p>
                </div>
                <div className="h-9 w-[1px] bg-[#E8EEE9]"></div>
                <div className="text-center w-1/2">
                    <p className="text-xs text-[#7A8B7E] font-medium mb-1">체크아웃</p>
                    <p className="font-black text-lg text-[#1E4D2B]">
                        {selected.to ? format(selected.to, 'yyyy.MM.dd') : '-'}
                    </p>
                </div>
            </div>
        </div>
    );
}
