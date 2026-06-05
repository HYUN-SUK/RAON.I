'use client';

import React from 'react';
import { Sparkles, Calendar, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button } from '@/components/ui/button';

interface UnwrittenScheduleInfo {
    id: string;
    title: string;
    campgroundName?: string;
    campgroundAddress?: string;
    startDate: string;
    endDate: string;
    isRaonai: boolean;
}

interface ReminderBannerProps {
    detail: UnwrittenScheduleInfo | null;
    onClick: () => void;
}

export default function ReminderBanner({ detail, onClick }: ReminderBannerProps) {
    if (!detail) return null;

    const campgroundName = detail.campgroundName || detail.title;
    const startDateFormatted = format(new Date(detail.startDate), 'M월 d일', { locale: ko });
    const endDateFormatted = format(new Date(detail.endDate), 'M월 d일', { locale: ko });
    const dateRangeStr = detail.startDate === detail.endDate
        ? startDateFormatted
        : `${startDateFormatted} ~ ${endDateFormatted}`;

    return (
        <div className="mx-4 mt-4 mb-2 p-4 bg-gradient-to-br from-[#224732]/5 to-[#224732]/10 border border-[#224732]/15 rounded-2xl shadow-sm flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#224732] tracking-wider uppercase">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    <span>추억 아카이빙</span>
                </div>
                <h4 className="text-sm font-extrabold text-stone-900 truncate">
                    ⛺ 지난 캠핑의 추억을 핀으로 꽂아보세요!
                </h4>
                <div className="flex items-center gap-1 text-[11px] text-stone-500 font-medium truncate">
                    <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span>
                        {campgroundName} ({dateRangeStr})
                    </span>
                </div>
            </div>
            <Button
                onClick={onClick}
                className="bg-[#224732] hover:bg-[#1a3626] text-white text-xs font-bold px-3 py-2 h-auto rounded-xl flex items-center gap-1 shrink-0 shadow-sm active:scale-95 transition-all"
            >
                <span>10초 기록</span>
                <ArrowRight className="w-3.5 h-3.5" />
            </Button>
        </div>
    );
}
