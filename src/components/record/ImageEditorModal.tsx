'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { X, Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';

// 동적 import (SSR 비활성화)
const CampingImageEditor = dynamic(
    () => import('@/components/record/ImageEditor'),
    {
        ssr: false,
        loading: () => (
            <div className="h-[400px] bg-gray-100 animate-pulse rounded-xl flex items-center justify-center">
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
            setDimensions({
                width: window.innerWidth,
                height: window.innerHeight * 0.7
            });
        }
    }, [isOpen]); // Recalculate when opened

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

    // Custom Modal implementation with Portal to escape Sheet stacking context
    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/80" onClick={onClose}>
            {/* Modal Content */}
            <div
                className="w-full h-[85vh] bg-white rounded-t-3xl overflow-hidden flex flex-col relative animate-in slide-in-from-bottom duration-300"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking content
            >
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-100 flex flex-row items-center justify-between shrink-0">
                    <span className="text-lg font-bold text-[#224732]">사진 편집</span>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleReset}
                            className="h-8 w-8"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="h-8 w-8"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Editor Area */}
                <div className="flex-1 overflow-hidden p-2 bg-[#f8f8f8]">
                    {imagePath && dimensions.width > 0 && (
                        <CampingImageEditor
                            ref={editorRef}
                            imagePath={imagePath}
                            width={dimensions.width} // Full width
                            height={dimensions.height} // 70% of screen height
                        />
                    )}
                </div>

                {/* Footer (Save Button) */}
                <div className="p-4 bg-white border-t border-gray-100 shrink-0">
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full bg-[#224732] hover:bg-[#1a3626] text-white h-12 text-base"
                    >
                        <Check className="w-5 h-5 mr-2" />
                        {isSaving ? '저장 중...' : '편집 완료'}
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
}
