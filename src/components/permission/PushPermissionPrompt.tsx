'use client';

import { Bell, X, Moon } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface PushPermissionPromptProps {
    isOpen: boolean;
    onAccept: () => void;
    onDismiss: () => void;
}

export default function PushPermissionPrompt({
    isOpen,
    onAccept,
    onDismiss,
}: PushPermissionPromptProps) {
    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onDismiss()}>
            <SheetContent
                side="bottom"
                className="rounded-t-3xl px-6 pb-10 pt-8 max-h-[70vh] bg-gradient-to-b from-white to-stone-50"
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
                    <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-5">
                        <Bell size={32} className="text-amber-600" />
                    </div>

                    {/* 타이틀 */}
                    <h2 className="text-xl font-bold text-stone-800 mb-4">
                        중요한 순간, 놓치지 마세요
                    </h2>

                    {/* 혜택 리스트 */}
                    <div className="text-left text-stone-600 text-sm mb-4 space-y-2.5">
                        <div className="flex items-center gap-2">
                            <span className="text-green-600 font-bold">✓</span>
                            <span>예약 확정 · 입금 안내</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-green-600 font-bold">✓</span>
                            <span>빈자리 알림</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-green-600 font-bold">✓</span>
                            <span>미션 소식</span>
                        </div>
                    </div>

                    {/* 조용시간 안내 */}
                    <div className="flex items-center gap-2 text-stone-400 text-xs mb-6 bg-stone-100 px-4 py-2 rounded-full">
                        <Moon size={14} />
                        <span>밤 10시 ~ 아침 8시엔 조용히</span>
                    </div>

                    {/* CTA 버튼 */}
                    <Button
                        onClick={onAccept}
                        className="w-full max-w-[280px] h-12 text-base font-semibold bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg shadow-green-600/20 mb-3"
                    >
                        알림 받기
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
