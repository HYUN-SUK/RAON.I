'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// 동적 import
const ImageEditor = dynamic(
    () => import('@/components/record/ImageEditor'),
    {
        ssr: false,
        loading: () => (
            <div className="fixed inset-0 z-[99999] bg-black flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
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
    const [mounted, setMounted] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    // imagePath(URL) -> File 객체 변환
    useEffect(() => {
        if (isOpen && imagePath) {
            const convertUrlToFile = async () => {
                try {
                    const response = await fetch(imagePath);
                    const blob = await response.blob();
                    const file = new File([blob], "edited_image.png", { type: blob.type });
                    setImageFile(file);
                } catch (error) {
                    console.error("Failed to load image file:", error);
                }
            };
            convertUrlToFile();
        } else {
            setImageFile(null);
        }
    }, [isOpen, imagePath]);

    // 모달이 닫힐 때만 Body Scroll 허용 (기존 로직 단순화)
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const handleSave = (file: File) => {
        // File -> DataURL 변환 후 부모에게 전달
        const reader = new FileReader();
        reader.onloadend = () => {
            if (reader.result) {
                onSave(reader.result as string);
                onClose();
            }
        };
        reader.readAsDataURL(file);
    };

    if (!mounted || !isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[99999] bg-black animate-in fade-in duration-200">
            {imageFile ? (
                <ImageEditor
                    imageFile={imageFile}
                    onClose={onClose}
                    onSave={handleSave}
                />
            ) : (
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
            )}
        </div>,
        document.body
    );
}
