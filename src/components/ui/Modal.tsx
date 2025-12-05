import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';


interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    className?: string;
    fullScreen?: boolean; // New prop for generic full screen usage
}

export function Modal({ isOpen, onClose, title, children, className, fullScreen = false }: ModalProps) {
    // 모달이 열려있을 때 스크롤 방지
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
            // Also reset any other styles if needed, though usually automatic
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    if (fullScreen) {
        return (
            <div className="fixed inset-0 z-50 flex justify-center bg-gray-100/50 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="w-full max-w-md h-full bg-white shadow-2xl overflow-hidden flex flex-col relative animate-in slide-in-from-bottom-10 duration-200">
                    {/* Full Screen Header */}
                    <div className="flex items-center p-4 border-b border-gray-100 shrink-0 bg-white">
                        <button
                            onClick={onClose}
                            className="p-2 mr-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            {/* Back Arrow Style for Full Screen */}
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                        </button>
                        <h3 className="text-lg font-bold text-gray-900 flex-1 text-center pr-8">{title}</h3>
                    </div>

                    {/* Full Screen Content */}
                    <div className={cn("flex-1 overflow-hidden relative flex flex-col", className)}>
                        {children}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            {/* 배경 클릭 시 닫기 */}
            <div className="absolute inset-0" onClick={onClose} />

            {/* 모달 컨텐츠 */}
            <div className={cn("relative z-50 w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]", className)}>
                {/* 헤더 */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
                    <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* 본문 (스크롤 가능) */}
                <div className="p-4 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
}
