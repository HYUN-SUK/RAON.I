'use client';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface TermsAgreementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAgree: () => void;
    rulesText: string;
    refundRulesText: string;
}

export default function TermsAgreementDialog({
    open,
    onOpenChange,
    onAgree,
    rulesText,
    refundRulesText,
}: TermsAgreementDialogProps) {
    const handleAgree = () => {
        onAgree();
        onOpenChange(false);
    };

    // 기본값 처리
    const displayRulesText = rulesText || `• 입실: 오후 2시 / 퇴실: 낮 12시
• 매너타임: 22:00 ~ 08:00
• 캠핑장 내 금연 구역을 준수해주세요.
• 반려동물은 사전 문의 부탁드립니다.`;

    const displayRefundText = refundRulesText || `• 7일 전: 100% 환불
• 5~6일 전: 90% 환불
• 3~4일 전: 50% 환불
• 1~2일 전: 20% 환불
• 당일: 환불 불가

※ 천재지변 등 불가피한 사유의 경우 별도 문의`;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold text-[#1C4526]">
                        이용규정 및 환불규정
                    </DialogTitle>
                    <DialogDescription className="text-sm text-gray-500">
                        예약 전 아래 내용을 확인해주세요.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-4 -mr-4 max-h-[400px]">
                    <div className="space-y-6 py-4">
                        {/* 이용수칙 섹션 */}
                        <div className="space-y-2">
                            <h3 className="font-semibold text-[#1C4526] flex items-center gap-2">
                                📋 이용수칙
                            </h3>
                            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                                {displayRulesText}
                            </div>
                        </div>

                        {/* 구분선 */}
                        <div className="border-t border-gray-200" />

                        {/* 환불규정 섹션 */}
                        <div className="space-y-2">
                            <h3 className="font-semibold text-[#1C4526] flex items-center gap-2">
                                💰 환불규정
                            </h3>
                            <div className="bg-amber-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                                {displayRefundText}
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="pt-4 border-t">
                    <Button
                        onClick={handleAgree}
                        className="w-full bg-[#1C4526] hover:bg-[#224732] text-white"
                    >
                        확인했습니다
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
