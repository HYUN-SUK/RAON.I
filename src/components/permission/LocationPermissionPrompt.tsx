'use client';

import { MapPin, X } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface LocationPermissionPromptProps {
    isOpen: boolean;
    onAccept: () => void;
    onDismiss: () => void;
}

export default function LocationPermissionPrompt({
    isOpen,
    onAccept,
    onDismiss,
}: LocationPermissionPromptProps) {
    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onDismiss()}>
            <SheetContent
                side="bottom"
                className="rounded-t-3xl px-6 pb-10 pt-8 max-h-[60vh] bg-gradient-to-b from-white to-stone-50"
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
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-5">
                        <MapPin size={32} className="text-green-600" />
                    </div>

                    {/* 타이틀 */}
                    <h2 className="text-xl font-bold text-stone-800 mb-3">
                        주변이 궁금하시죠?
                    </h2>

                    {/* 설명 */}
                    <div className="text-stone-600 text-sm leading-relaxed mb-6 max-w-[280px]">
                        <p className="mb-2">
                            캠핑장 근처 맛집, 마트, 주유소를
                        </p>
                        <p>
                            알려드릴게요. <span className="text-blue-600 font-medium">현재 날씨</span>도요!
                        </p>
                    </div>

                    {/* CTA 버튼 */}
                    <Button
                        onClick={onAccept}
                        className="w-full max-w-[280px] h-12 text-base font-semibold bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg shadow-green-600/20 mb-3"
                    >
                        위치 정보 허용하기
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
