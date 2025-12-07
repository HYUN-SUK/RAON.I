import React from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

interface PriceGuideSheetProps {
    children: React.ReactNode;
}

export function PriceGuideSheet({ children }: PriceGuideSheetProps) {
    return (
        <Sheet>
            <SheetTrigger asChild>
                {children}
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-[32px] px-6 pb-10">
                <SheetHeader className="text-left mb-6">
                    <Badge variant="outline" className="w-fit mb-2 border-[#C3A675] text-[#C3A675]">Price Decoding</Badge>
                    <SheetTitle className="text-2xl font-bold text-[#1C4526] leading-snug">
                        라온아이 이용료,<br />
                        이런 가치가 담겨있어요.
                    </SheetTitle>
                    <SheetDescription>
                        숨겨진 추가 요금 없이, 모든 것을 누리세요.
                    </SheetDescription>
                </SheetHeader>

                <div className="space-y-6">
                    {/* item 1 */}
                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#E8F5E9] flex items-center justify-center shrink-0">
                            <span className="text-lg font-bold text-[#1C4526]">2x</span>
                        </div>
                        <div>
                            <h4 className="font-bold text-stone-900 dark:text-stone-100 text-lg">2배 더 넓은 사이트</h4>
                            <p className="text-stone-600 dark:text-stone-400 text-sm mt-1 leading-relaxed">
                                일반 캠핑장(6mx8m)보다 훨씬 넓은 10mx10m 사이트를 제공합니다.
                                옆 텐트 소음 걱정 없이 우리만의 프라이빗한 시간을 즐기세요.
                            </p>
                        </div>
                    </div>

                    {/* item 2 */}
                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#E8F5E9] flex items-center justify-center shrink-0">
                            <Check className="w-6 h-6 text-[#1C4526]" />
                        </div>
                        <div>
                            <h4 className="font-bold text-stone-900 dark:text-stone-100 text-lg">개별 욕실 & 개수대</h4>
                            <p className="text-stone-600 dark:text-stone-400 text-sm mt-1 leading-relaxed">
                                공용 시설까지 걸어갈 필요 없어요.
                                사이트 바로 옆에 우리 가족만 쓰는 전용 편의시설이 준비되어 있습니다.
                            </p>
                        </div>
                    </div>

                    {/* item 3 */}
                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#E8F5E9] flex items-center justify-center shrink-0">
                            <span className="text-lg font-bold text-[#1C4526]">0</span>
                        </div>
                        <div>
                            <h4 className="font-bold text-stone-900 dark:text-stone-100 text-lg">추가 요금 0원</h4>
                            <p className="text-stone-600 dark:text-stone-400 text-sm mt-1 leading-relaxed">
                                인원 추가, 차량 추가, 쓰레기 봉투값...
                                현장에서 당황하지 마세요. 라온아이는 모든 필수 비용이 포함되어 있습니다.
                            </p>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
