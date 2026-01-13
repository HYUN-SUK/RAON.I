import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Share, PlusSquare, MoreVertical, Download } from 'lucide-react';
import Image from 'next/image';

interface PWAInstallGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
    platform: 'ios' | 'android' | 'pc' | 'mac';
}

export default function PWAInstallGuideModal({ isOpen, onClose, platform }: PWAInstallGuideModalProps) {

    const renderInstructions = () => {
        if (platform === 'ios') {
            return (
                <>
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
                </>
            );
        }

        // Android / PC (Chrome)
        return (
            <>
                <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-50">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-200 text-stone-600">
                        <MoreVertical size={18} />
                    </span>
                    <div className="text-sm">
                        <p className="font-semibold text-gray-900">1. 브라우저 메뉴 열기</p>
                        <p className="text-xs text-gray-500">
                            {platform === 'pc'
                                ? "우측 상단 URL 주소창 옆의 '설치' 아이콘 또는 점 3개를 누르세요."
                                : "우측 상단 점 3개 메뉴를 누르세요."}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-50">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-200 text-stone-600">
                        {platform === 'pc' ? <Download size={18} /> : <PlusSquare size={18} />}
                    </span>
                    <div className="text-sm">
                        <p className="font-semibold text-gray-900">2. 앱 설치 / 홈 화면에 추가</p>
                        <p className="text-xs text-gray-500">메뉴에서 설치 항목을 선택하세요.</p>
                    </div>
                </div>
            </>
        );
    };

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
                        앱 설치하고 혜택받기
                    </DialogTitle>
                    <DialogDescription className="text-center text-gray-600 pt-2">
                        {platform === 'ios' ? '아이폰은 수동 설치가 필요해요' : '앱처럼 빠르고 간편하게!'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-2">
                    {renderInstructions()}
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
