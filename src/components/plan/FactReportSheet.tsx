'use client';

import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';
import { DoorClosed, Store, Clock, MapPinOff, Check } from 'lucide-react';

interface FactReportSheetProps {
    isOpen: boolean;
    onClose: () => void;
    placeId: string;
    placeName: string;
    stage?: string;
    scheduleId?: string;
    userId?: string;
    distanceKm?: number;
}

const REPORT_OPTIONS = [
    { 
        status: 'TEMP_CLOSED', 
        label: '오늘 문이 닫혀 있었어요', 
        subLabel: '임시 휴무 또는 휴일',
        icon: DoorClosed, 
        color: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100' 
    },
    { 
        status: 'GONE', 
        label: '간판이 없거나 다른 가게였어요', 
        subLabel: '폐업 또는 업종 변경 징후',
        icon: Store, 
        color: 'text-rose-600 bg-rose-50 border-rose-200 hover:bg-rose-100' 
    },
    { 
        status: 'HOURS_WRONG', 
        label: '영업시간이 달라요', 
        subLabel: '오픈/마감 시간 차이',
        icon: Clock, 
        color: 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100' 
    },
    { 
        status: 'NOT_FOUND', 
        label: '이 위치에 없어요', 
        subLabel: '위치 좌표 오류',
        icon: MapPinOff, 
        color: 'text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100' 
    },
] as const;

export default function FactReportSheet({
    isOpen,
    onClose,
    placeId,
    placeName,
    stage = 'DESTINATION',
    scheduleId,
    userId,
    distanceKm,
}: FactReportSheetProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

    const handleSelectOption = async (factStatus: string) => {
        setSelectedStatus(factStatus);
        setIsSubmitting(true);

        try {
            const supabase = createClient();
            const now = new Date();

            const { error } = await supabase
                .from('place_verifications')
                .insert({
                    partner_id: 'a0000000-0000-0000-0000-000000000001',
                    schedule_id: scheduleId || null,
                    place_id: placeId,
                    user_id: userId || null,
                    stage: stage || 'DESTINATION',
                    visited: true,
                    liked: false,
                    fact_status: factStatus,
                    observed_at: now.toISOString().split('T')[0],
                    observed_dow: now.getDay(),
                    distance_km: distanceKm || null,
                    source: 'APP_USER',
                    entry_point: 'card',
                    evidence: scheduleId ? 'SCHEDULE_MATCH' : 'SELF_REPORT',
                    reporter_weight: scheduleId ? 0.5 : 0.3,
                    review_state: 'PENDING',
                    verified_at: now.toISOString(),
                });

            if (error) {
                console.warn('[FactReportSheet] insert error:', error.message);
            }

            // 약속과 실제 일치 원칙: "확인해서 반영할게요 🌿"
            toast.success(`알려주셔서 고마워요. 확인해서 반영할게요 🌿`, {
                duration: 4000,
            });

            setTimeout(() => {
                onClose();
                setSelectedStatus(null);
                setIsSubmitting(false);
            }, 300);
        } catch (e) {
            console.error('[FactReportSheet] unexpected error:', e);
            toast.error('전송 중 오류가 발생했습니다.');
            setIsSubmitting(false);
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="bottom" className="rounded-t-3xl max-h-[80vh] overflow-y-auto bg-[#F7F5EF] px-5 pb-8">
                <SheetHeader className="pb-3 border-b border-stone-200">
                    <SheetTitle className="text-left text-lg font-bold text-stone-900">
                        {placeName}
                    </SheetTitle>
                    <SheetDescription className="text-left text-xs text-stone-500">
                        무엇이 달랐나요? 관측하신 사실을 선택해 주세요.
                    </SheetDescription>
                </SheetHeader>

                <div className="py-4 space-y-2.5">
                    {REPORT_OPTIONS.map(opt => {
                        const isSelected = selectedStatus === opt.status;
                        const Icon = opt.icon;

                        return (
                            <button
                                key={opt.status}
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => handleSelectOption(opt.status)}
                                className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all active:scale-[0.98] ${
                                    isSelected
                                        ? 'bg-stone-900 text-white border-stone-900'
                                        : 'bg-white hover:bg-stone-50 border-stone-200'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-xl border ${opt.color}`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-stone-900'}`}>
                                            {opt.label}
                                        </div>
                                        <div className={`text-xs ${isSelected ? 'text-stone-300' : 'text-stone-400'} mt-0.5`}>
                                            {opt.subLabel}
                                        </div>
                                    </div>
                                </div>
                                {isSelected && (
                                    <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="text-center pt-2">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onClose}
                        className="text-xs text-stone-400 hover:text-stone-600"
                    >
                        닫기
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
