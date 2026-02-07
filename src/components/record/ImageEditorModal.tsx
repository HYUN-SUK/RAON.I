'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { X, Check, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';

// 동적 import (SSR 비활성화)
const CampingImageEditor = dynamic(
    () => import('@/components/record/ImageEditor'),
    {
        ssr: false,
        loading: () => (
            <div className="h-full bg-gray-100 animate-pulse rounded-xl flex items-center justify-center">
                <span className="text-gray-400">이미지 편집기 로딩중...</span>
            </div>
        )
    }
);

interface ImageEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    imagePath: string;
    onSave: (editedImageDataUrl: string) => void;
}

// 모달 레이아웃 상수
const HEADER_HEIGHT = 56; // px
const MODAL_HEIGHT_VH = 95; // 더 크게

export default function ImageEditorModal({
    isOpen,
    onClose,
    imagePath,
    onSave,
}: ImageEditorModalProps) {
    const editorRef = useRef<{ getEditedImage: () => Promise<string | null>; reset: () => void } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (typeof window !== 'undefined') {
            const modalHeight = window.innerHeight * (MODAL_HEIGHT_VH / 100);
            // Footer 제거했으므로 헤더만 빼면 됨
            const editorHeight = modalHeight - HEADER_HEIGHT;

            setDimensions({
                width: window.innerWidth,
                height: Math.max(editorHeight, 400)
            });
        }
    }, [isOpen]);

    // 모달 열릴 때 body 스크롤 방지 + 화면 밀림 방지
    useEffect(() => {
        if (!isOpen) return;

        // 현재 body 스타일 저장
        const originalOverflow = document.body.style.overflow;
        const originalPaddingRight = document.body.style.paddingRight;
        const originalPosition = document.body.style.position;

        // 스크롤바 너비 계산 (있으면)
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

        // body 스크롤 방지 (paddingRight는 건드리지 않음 - 화면 밀림 방지)
        document.body.style.overflow = 'hidden';

        return () => {
            // 원래 스타일로 복원
            document.body.style.overflow = originalOverflow;
            document.body.style.paddingRight = originalPaddingRight;
            document.body.style.position = originalPosition;
        };
    }, [isOpen]);

    // ESC 키로 모달 닫기
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const handleSave = useCallback(async () => {
        if (!editorRef.current) return;

        setIsSaving(true);
        try {
            const dataUrl = await editorRef.current.getEditedImage();
            if (dataUrl) {
                onSave(dataUrl);
                onClose();
            }
        } catch (err) {
            console.error('Failed to save edited image:', err);
        } finally {
            setIsSaving(false);
        }
    }, [onSave, onClose]);

    const handleReset = useCallback(() => {
        editorRef.current?.reset();
    }, []);

    // 배경 클릭시에만 닫히도록 (TUI 에디터 요소 및 모달 내부 클릭은 예외)
    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        // 모달 컨텐츠 내부 클릭은 무시 (배경만 클릭할 때만 닫기)
        if (e.target !== e.currentTarget) {
            return;
        }
        onClose();
    }, [onClose]);

    // Custom Modal implementation with Portal to escape Sheet stacking context
    if (!isOpen || !mounted) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/80"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-label="이미지 편집"
        >
            {/* Modal Content - onClick과 onDoubleClick 차단 */}
            <div
                className="w-full bg-white rounded-t-3xl overflow-hidden flex flex-col relative animate-in slide-in-from-bottom duration-300"
                style={{ height: `${MODAL_HEIGHT_VH}vh` }}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
            >
                {/* Header with Save Button */}
                <div
                    className="px-4 border-b border-gray-100 flex flex-row items-center justify-between shrink-0 bg-white"
                    style={{ height: HEADER_HEIGHT }}
                >
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                        className="h-10 w-10 hover:bg-gray-100 rounded-full"
                        title="닫기"
                    >
                        <X className="w-5 h-5 text-gray-600" />
                    </Button>

                    <span className="text-lg font-bold text-[#224732]">📸 사진 편집</span>

                    <div className="flex gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleReset();
                            }}
                            className="h-10 w-10 hover:bg-gray-100 rounded-full"
                            title="초기화"
                        >
                            <RotateCcw className="w-5 h-5 text-gray-600" />
                        </Button>
                        <Button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSave();
                            }}
                            disabled={isSaving}
                            className="h-10 px-4 bg-[#224732] hover:bg-[#1a3626] text-white rounded-full font-medium"
                            title="저장"
                        >
                            {isSaving ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Check className="w-5 h-5 mr-1" />
                                    완료
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Editor Area - onClick만 stopPropagation하여 배경 클릭 닫기 방지, mouseDown/Up은 TUI에게 전달 */}
                <div
                    className="flex-1 overflow-visible bg-[#282828] relative"
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                >
                    {imagePath && dimensions.width > 0 && (
                        <CampingImageEditor
                            ref={editorRef}
                            imagePath={imagePath}
                            width={dimensions.width}
                            height={dimensions.height}
                        />
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

