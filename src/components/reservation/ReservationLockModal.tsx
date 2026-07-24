'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Tent, Calendar, Phone, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';

import { CAMP_OWNER_PHONE } from '@/constants/reservationGuard';

interface ReservationLockModalProps {
    isOpen: boolean;
    onClose?: () => void;
    contactPhone?: string;
}

/**
 * 🏕️ [CampWarm 감성] 예약 오픈 안내 커스텀 모달
 * - 8월 초 예약 기능 정식 오픈 전 미허용 유저 대상 팝업
 */
export default function ReservationLockModal({
    isOpen,
    onClose,
    contactPhone = CAMP_OWNER_PHONE, // 캠장님 실기기 전화번호
}: ReservationLockModalProps) {
    const router = useRouter();

    const handleConfirm = () => {
        if (onClose) onClose();
        router.replace('/');
    };

    const handleCallContact = () => {
        window.location.href = `tel:${contactPhone.replace(/-/g, '')}`;
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleConfirm()}>
            <DialogContent className="w-[90%] max-w-[360px] rounded-3xl p-6 bg-[#F7F5EF] border border-[#224732]/15 shadow-2xl space-y-4">
                {/* 상단 그래픽 아이콘 배지 */}
                <div className="flex flex-col items-center justify-center text-center space-y-2 pt-2">
                    <div className="relative">
                        <div className="w-16 h-16 rounded-full bg-[#224732] flex items-center justify-center shadow-lg text-[#C3A675]">
                            <Tent className="w-8 h-8 animate-bounce" />
                        </div>
                        <div className="absolute -top-1 -right-1 bg-amber-400 text-amber-950 p-1 rounded-full shadow">
                            <Sparkles className="w-3.5 h-3.5" />
                        </div>
                    </div>

                    <DialogHeader className="pt-2 space-y-1">
                        <DialogTitle className="text-center text-lg font-extrabold text-[#224732] tracking-tight">
                            라온아이 예약 오픈 안내
                        </DialogTitle>
                        <DialogDescription className="text-center text-xs text-stone-500 font-medium">
                            더 편리한 캠핑 예약을 준비하고 있어요
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* 본문 안내 카드 */}
                <div className="bg-white rounded-2xl p-4 border border-stone-200/60 shadow-sm space-y-2.5 text-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#224732]/10 text-[#224732] text-xs font-bold">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>8월 초 정식 오픈 예정</span>
                    </div>
                    <p className="text-xs text-stone-700 font-medium leading-relaxed break-keep">
                        우리 앱의 직접 예약 기능은 <strong className="text-[#224732] font-bold">8월 초에 오픈</strong>됩니다! 🏕️
                    </p>
                    <p className="text-[11px] text-stone-500 leading-normal">
                        궁금한 점이 있으시거나 미리 일정을 확인하고 싶으시면 캠장님께 직접 문의해 주세요.
                    </p>
                </div>

                {/* 하단 버튼 2종 */}
                <div className="space-y-2 pt-1">
                    <Button
                        onClick={handleCallContact}
                        variant="outline"
                        className="w-full h-11 rounded-2xl border-[#224732]/30 text-[#224732] hover:bg-[#224732]/5 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    >
                        <Phone className="w-4 h-4 text-[#224732]" />
                        <span>캠장님에게 전화 문의하기</span>
                    </Button>

                    <Button
                        onClick={handleConfirm}
                        className="w-full h-11 bg-[#224732] hover:bg-[#1a3626] text-white rounded-2xl text-xs font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                    >
                        <Check className="w-4 h-4 text-[#C3A675]" />
                        <span>확인 (홈으로 이동)</span>
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
