'use client';

import * as React from 'react';
import { DayPicker, DateRange } from 'react-day-picker';
import { ko } from 'date-fns/locale';
import { format } from 'date-fns';
import { useReservationStore } from '@/store/useReservationStore';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
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

    return (
        <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl">
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
                    { before: new Date() }, // Disable past dates
                    { after: new Date(new Date().setMonth(new Date().getMonth() + 2)) } // Open Day Policy: Max 2 months ahead
                ]}
                footer={
                    selected.from && !selected.to ? (
                        <p className="text-xs text-yellow-400 mt-4 text-center">
                            💡 주말은 2박 이상 예약을 권장합니다.
                        </p>
                    ) : null
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
