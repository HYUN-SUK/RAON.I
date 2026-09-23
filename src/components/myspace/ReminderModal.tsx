'use client';

import React, { useState } from 'react';
import { Sparkles, Calendar, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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

interface ReminderModalProps {
    isOpen: boolean;
    onClose: (dontShowToday: boolean) => void;
    detail: UnwrittenScheduleInfo | null;
    onGoRecord: () => void;
}

export default function ReminderModal({ isOpen, onClose, detail, onGoRecord }: ReminderModalProps) {
    const [dontShowToday, setDontShowToday] = useState(false);

    if (!detail) return null;

    const campgroundName = detail.campgroundName || detail.title;
    let dateRangeStr = '';
    try {
        const startDateFormatted = format(new Date(detail.startDate), 'M월 d일', { locale: ko });
        const endDateFormatted = format(new Date(detail.endDate), 'M월 d일', { locale: ko });
        dateRangeStr = detail.startDate === detail.endDate
            ? startDateFormatted
            : `${startDateFormatted} ~ ${endDateFormatted}`;
    } catch {}

    const handleDismiss = () => {
        onClose(dontShowToday);
    };

    const handleConfirm = () => {
        onGoRecord();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleDismiss(); }}>
            <DialogContent className="w-[90%] max-w-[360px] rounded-3xl p-6 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 shadow-2xl space-y-4">
                <DialogTitle className="sr-only">캠핑 추억 기록 알림</DialogTitle>
                <DialogDescription className="sr-only">지난 캠핑의 추억을 10초 만에 기록해보세요.</DialogDescription>

                {/* 상단 뱃지 & 아이콘 */}
                <div className="flex flex-col items-center text-center space-y-2 pt-2">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#224732] to-[#163022] text-white flex items-center justify-center shadow-md">
                        <Sparkles className="w-6 h-6 text-emerald-300 animate-pulse" />
                    </div>
                    <span className="text-[11px] font-black text-[#224732] dark:text-emerald-400 bg-[#224732]/10 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full tracking-wider">
                        추억 아카이빙
                    </span>
                    <h3 className="text-base font-black text-stone-900 dark:text-stone-100 leading-snug">
                        지난 캠핑의 추억을<br />핀으로 꽂아보세요!
                    </h3>
                </div>

                {/* 캠핑 정보 박스 */}
                <div className="p-3.5 bg-stone-50 dark:bg-zinc-850 border border-stone-200/80 dark:border-zinc-700/80 rounded-2xl space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800 dark:text-stone-200 truncate">
                        <span>⛺</span>
                        <span className="truncate">{campgroundName}</span>
                    </div>
                    {dateRangeStr && (
                        <div className="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <span>{dateRangeStr}</span>
                        </div>
                    )}
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 pt-1 leading-relaxed">
                        사진 1장과 한 줄 소감으로 10초 만에 영구 기록해보세요.
                    </p>
                </div>

                {/* 오늘 하루 보지 않기 체크박스 */}
                <div className="flex items-center justify-center gap-2 pt-1">
                    <input
                        type="checkbox"
                        id="reminderDontShowToday"
                        checked={dontShowToday}
                        onChange={(e) => setDontShowToday(e.target.checked)}
                        className="w-4 h-4 rounded border-stone-300 text-[#224732] focus:ring-[#224732] cursor-pointer"
                    />
                    <label
                        htmlFor="reminderDontShowToday"
                        className="text-xs text-stone-500 dark:text-stone-400 font-medium cursor-pointer select-none"
                    >
                        오늘 하루 보지 않기
                    </label>
                </div>

                {/* 버튼 2종 */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button
                        variant="outline"
                        onClick={handleDismiss}
                        className="w-full h-11 rounded-xl text-stone-600 dark:text-stone-300 text-xs font-bold border-stone-200 dark:border-zinc-700 hover:bg-stone-100 dark:hover:bg-zinc-800 cursor-pointer active:scale-[0.98] transition-all"
                    >
                        다음에 하기
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        className="w-full h-11 rounded-xl bg-[#224732] hover:bg-[#1a3626] text-white text-xs font-bold shadow-md cursor-pointer active:scale-[0.98] transition-all flex items-center justify-center gap-1"
                    >
                        <span>10초 기록하기</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
