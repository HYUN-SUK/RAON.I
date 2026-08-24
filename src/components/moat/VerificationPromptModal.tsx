'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, UtensilsCrossed, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

import { useMySpaceStore } from '@/store/useMySpaceStore';

interface VerificationPromptModalProps {
    isOpen?: boolean;
    scheduleId?: string | null;
    onClose?: () => void;
}

export default function VerificationPromptModal({
    isOpen: propIsOpen,
    scheduleId: propScheduleId,
    onClose: propOnClose
}: VerificationPromptModalProps = {}) {
    const router = useRouter();
    const { 
        isVerificationPromptOpen, 
        verificationPromptScheduleId, 
        closeVerificationPrompt 
    } = useMySpaceStore();

    const activeIsOpen = propIsOpen !== undefined ? propIsOpen : isVerificationPromptOpen;
    const activeScheduleId = propScheduleId !== undefined ? propScheduleId : verificationPromptScheduleId;
    const handleClose = propOnClose || closeVerificationPrompt;

    if (!activeIsOpen || !activeScheduleId) return null;

    const handleGoToVerify = () => {
        handleClose();
        router.push(`/verify/${activeScheduleId}`);
    };

    return (
        <Dialog open={activeIsOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>

            <DialogContent className="max-w-xs sm:max-w-sm rounded-3xl p-6 bg-gradient-to-b from-stone-900 via-stone-900 to-stone-950 text-white border border-amber-500/30 shadow-2xl overflow-hidden">
                {/* Background Glow */}
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="relative z-10 text-center space-y-4 pt-2">
                    {/* Top Icon Badge */}
                    <div className="w-14 h-14 bg-gradient-to-tr from-amber-500 to-amber-300 text-stone-950 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20 animate-bounce">
                        <UtensilsCrossed className="w-7 h-7" />
                    </div>

                    {/* Header Text */}
                    <div className="space-y-1.5">
                        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold">
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            <span>1초 팩트 체크 & 탐험 보너스</span>
                        </div>
                        <h3 className="text-lg font-black text-white tracking-tight">
                            다녀오신 추천 맛집·명소는<br />
                            어떠셨나요? 🌟
                        </h3>
                        <p className="text-xs text-stone-400 leading-relaxed pt-1">
                            라온아이가 추천해 드린 장소의 의견을 남겨주시면<br />
                            <strong className="text-amber-300 font-bold">탐험 포인트 +100P</strong>를 즉시 드려요!
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 space-y-2">
                        <Button
                            onClick={handleGoToVerify}
                            className="w-full h-12 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-stone-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-transform active:scale-95"
                        >
                            <span>🌟 1초 의견 남기러 가기 (+100P)</span>
                            <ArrowRight className="w-4 h-4" />
                        </Button>

                        <button
                            onClick={handleClose}
                            className="w-full py-2 text-xs font-semibold text-stone-500 hover:text-stone-300 transition-colors"
                        >
                            다음에 할게요
                        </button>

                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
