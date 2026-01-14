import React, { useState, useEffect } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Coins } from "lucide-react";

interface PriceGuideSheetProps {
    children: React.ReactNode;
    pricingText?: string | null;
}

export function PriceGuideSheet({ children, pricingText }: PriceGuideSheetProps) {
    const [isOpen, setIsOpen] = useState(false);

    // 백버튼 처리: Sheet 열릴 때 히스토리 추가, 백버튼 시 Sheet 닫기
    useEffect(() => {
        if (isOpen) {
            history.pushState({ sheet: 'price' }, '');

            const handlePopState = () => {
                setIsOpen(false);
            };

            window.addEventListener('popstate', handlePopState);

            return () => {
                window.removeEventListener('popstate', handlePopState);
            };
        }
    }, [isOpen]);

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                {children}
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-[32px] px-6 pb-10 h-[80vh] overflow-y-auto scrollbar-hide bg-stone-50 dark:bg-zinc-900">
                <SheetHeader className="text-left mb-6 pt-6">
                    <Badge variant="outline" className="w-fit mb-2 border-[#C3A675] text-[#C3A675]">Price Decoding</Badge>
                    <SheetTitle className="text-2xl font-bold text-[#1C4526] dark:text-[#A7F3D0] leading-snug">
                        라온아이 이용료,<br />
                        이런 가치가 담겨있어요.
                    </SheetTitle>
                    <SheetDescription>
                        숨겨진 추가 요금 없이, 모든 것을 누리세요.
                    </SheetDescription>
                </SheetHeader>

                <div className="space-y-8 pb-12">
                    {/* 0. Admin Dynamic Price Text (Priority) */}
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl p-6 shadow-sm border border-stone-100 dark:border-zinc-700">
                        <div className="flex items-center gap-2 mb-4">
                            <Coins className="w-5 h-5 text-[#C3A675]" />
                            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">상세 이용 요금</h3>
                        </div>
                        <p className="text-stone-600 dark:text-stone-300 whitespace-pre-wrap leading-relaxed text-sm">
                            {pricingText || "등록된 가격 정보가 없습니다.\n관리자에게 문의해주세요."}
                        </p>
                    </div>


                </div>
            </SheetContent>
        </Sheet>
    );
}
