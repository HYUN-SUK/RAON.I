import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Share, PlusSquare } from 'lucide-react';
import Image from 'next/image';

interface IOSInstallModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function IOSInstallModal({ isOpen, onClose }: IOSInstallModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[320px] rounded-2xl bg-white/95 backdrop-blur-sm border-none shadow-2xl">
                <DialogHeader>
                    <div className="flex justify-center mb-4">
                        <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-lg border border-gray-100">
                            <Image
                                src="/icons/logo-original.jpg"
                                alt="App Icon"
                                fill
                                className="object-cover"
                            />
                        </div>
                    </div>
                    <DialogTitle className="text-center text-lg font-bold text-gray-900">
                        홈 화면에 추가하기
                    </DialogTitle>
                    <DialogDescription className="text-center text-gray-600 pt-2">
                        앱처럼 간편하게 사용해보세요!
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-2">
                    <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-50">
                        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-200 text-blue-600">
                            <Share size={18} />
                        </span>
                        <div className="text-sm">
                            <p className="font-semibold text-gray-900">1. 공유 버튼 누르기</p>
                            <p className="text-xs text-gray-500">브라우저 하단 중앙에 있어요.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-50">
                        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-200 text-gray-600">
                            <PlusSquare size={18} />
                        </span>
                        <div className="text-sm">
                            <p className="font-semibold text-gray-900">2. 홈 화면에 추가 선택</p>
                            <p className="text-xs text-gray-500">메뉴를 아래로 내려서 찾으세요.</p>
                        </div>
                    </div>
                </div>

                <div className="text-center mt-2">
                    <button
                        onClick={onClose}
                        className="text-sm text-blue-600 font-semibold px-4 py-2 active:opacity-70"
                    >
                        알겠습니다
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
