'use client';

import { Smartphone, X, Share, PlusSquare, ChevronRight } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface IOSPWAGuidePromptProps {
    isOpen: boolean;
    onAccept: () => void;
    onDismiss: () => void;
}

export default function IOSPWAGuidePrompt({
    isOpen,
    onAccept,
    onDismiss,
}: IOSPWAGuidePromptProps) {
    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onDismiss()}>
            <SheetContent
                side="bottom"
                className="rounded-t-3xl px-6 pb-10 pt-8 max-h-[80vh] bg-gradient-to-b from-white to-stone-50"
            >
                {/* 닫기 버튼 */}
                <button
                    onClick={onDismiss}
                    className="absolute right-4 top-4 p-2 rounded-full hover:bg-stone-100 transition-colors"
                    aria-label="닫기"
                >
                    <X size={20} className="text-stone-400" />
                </button>

                {/* 콘텐츠 */}
                <div className="flex flex-col items-center text-center">
                    {/* 아이콘 */}
                    <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-5">
                        <Smartphone size={32} className="text-blue-600" />
                    </div>

                    {/* 타이틀 */}
                    <h2 className="text-xl font-bold text-stone-800 mb-3">
                        앱처럼 편하게 쓰려면
                    </h2>

                    {/* 설명 */}
                    <p className="text-stone-600 text-sm mb-6">
                        홈 화면에 추가하시면<br />
                        <span className="text-blue-600 font-medium">알림도 받을 수 있어요!</span>
                    </p>

                    {/* 가이드 스텝 */}
                    <div className="w-full max-w-[300px] bg-white rounded-2xl border border-stone-200 p-4 mb-6 shadow-sm">
                        <div className="text-left space-y-4">
                            {/* Step 1 */}
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                    <span className="text-blue-600 font-bold text-sm">1</span>
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                    <Share size={18} className="text-blue-600" />
                                    <span className="text-stone-700 text-sm">하단의 <strong>공유</strong> 버튼 탭</span>
                                </div>
                            </div>

                            {/* Arrow */}
                            <div className="flex justify-center">
                                <ChevronRight size={16} className="text-stone-300 rotate-90" />
                            </div>

                            {/* Step 2 */}
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                    <span className="text-blue-600 font-bold text-sm">2</span>
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                    <PlusSquare size={18} className="text-blue-600" />
                                    <span className="text-stone-700 text-sm"><strong>홈 화면에 추가</strong> 선택</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CTA 버튼 */}
                    <Button
                        onClick={onAccept}
                        className="w-full max-w-[280px] h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-600/20 mb-3"
                    >
                        방법 확인했어요
                    </Button>

                    {/* 나중에 버튼 */}
                    <button
                        onClick={onDismiss}
                        className="text-stone-400 text-sm hover:text-stone-600 transition-colors py-2"
                    >
                        나중에 할게요
                    </button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
