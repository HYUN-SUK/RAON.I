'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Camera, X, ArrowLeft } from 'lucide-react';
import { communityService } from '@/services/communityService';
import { z } from 'zod';
import { Post } from '@/store/useCommunityStore';

// Shared Schema
const noticeSchema = z.object({
    title: z.string().min(1, '제목을 입력해주세요.'),
    content: z.string().min(1, '내용을 입력해주세요.'),
    images: z.array(z.any()).max(5, '사진은 최대 5장까지 업로드 가능합니다.'),
});

interface AdminNoticeFormProps {
    initialData?: Post;
    mode: 'CREATE' | 'EDIT';
    onSubmit: (data: { title: string; content: string; images: string[]; status: 'OPEN' | 'CLOSED' }) => Promise<void>;
    isLoading?: boolean;
}

export default function AdminNoticeForm({ initialData, mode, onSubmit, isLoading = false }: AdminNoticeFormProps) {
    const router = useRouter();
    const [title, setTitle] = useState(initialData?.title || '');
    const [content, setContent] = useState(initialData?.content || '');
    const [status, setStatus] = useState<'OPEN' | 'CLOSED'>(initialData?.status === 'CLOSED' ? 'CLOSED' : 'OPEN');

    // Existing URLs (for Edit mode)
    const [existingImages, setExistingImages] = useState<string[]>(initialData?.images || []);
    // New Files
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

    // Combined Preview
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);

    useEffect(() => {
        if (initialData) {
            setTitle(initialData.title);
            setContent(initialData.content);
            setStatus(initialData.status === 'CLOSED' ? 'CLOSED' : 'OPEN');
            setExistingImages(initialData.images || []);
        }
    }, [initialData]);

    // Update previews when files change
    useEffect(() => {
        const fileUrls = selectedFiles.map(file => URL.createObjectURL(file));
        // Note: In a real app, we should revoke these object URLs
        return () => fileUrls.forEach(url => URL.revokeObjectURL(url));
    }, [selectedFiles]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            if (existingImages.length + selectedFiles.length + newFiles.length > 5) {
                alert('사진은 최대 5장까지 추가할 수 있습니다.');
                return;
            }
            setSelectedFiles(prev => [...prev, ...newFiles]);
        }
    };

    const removeExistingImage = (urlToRemove: string) => {
        setExistingImages(prev => prev.filter(url => url !== urlToRemove));
    };

    const removeNewFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        const validation = noticeSchema.safeParse({ title, content, images: [...existingImages, ...selectedFiles] });
        if (!validation.success) {
            alert(validation.error.issues[0].message);
            return;
        }

        try {
            // 1. Upload New Images
            const newImageUrls: string[] = [];
            if (selectedFiles.length > 0) {
                // In a real app, handle upload loading state here or inside onSubmit
                // For now, we assume parent handles "isLoading" visual, but we do the upload here or parent?
                // Better to simple: upload here.
                const uploadPromises = selectedFiles.map(file => communityService.uploadImage(file));
                const results = await Promise.all(uploadPromises);
                newImageUrls.push(...results);
            }

            // 2. Combine
            const finalImages = [...existingImages, ...newImageUrls];

            // 3. Submit
            await onSubmit({ title, content, images: finalImages, status });

        } catch (error: any) {
            console.error('Form Submit Error:', error);
            alert(`오류가 발생했습니다.\n${error.message}`);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button type="button" onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-2xl font-bold text-gray-800">
                        {mode === 'CREATE' ? '공지사항 작성' : '공지사항 수정'}
                    </h2>
                </div>

                {mode === 'EDIT' && (
                    <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {status === 'OPEN' ? '노출 중' : '노출 중지'}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setStatus(prev => prev === 'OPEN' ? 'CLOSED' : 'OPEN')}
                        >
                            상태 변경
                        </Button>
                    </div>
                )}
            </div>

            <div className="bg-white p-6 rounded-lg shadow border space-y-6">
                {/* Title */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                    <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="text-lg"
                        placeholder="공지 제목을 입력하세요"
                    />
                </div>

                {/* Content */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                    <Textarea
                        className="min-h-[300px] resize-none text-base leading-relaxed"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="공지 내용을 입력하세요"
                    />
                </div>

                {/* Images */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        사진 첨부 ({existingImages.length + selectedFiles.length}/5)
                    </label>
                    <div className="flex flex-wrap gap-3">
                        {/* Existing Images */}
                        {existingImages.map((url, index) => (
                            <div key={`existing-${index}`} className="relative w-24 h-24 rounded-lg overflow-hidden border">
                                <img src={url} alt="preview" className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => removeExistingImage(url)}
                                    className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}

                        {/* New File Previews */}
                        {selectedFiles.map((file, index) => (
                            <div key={`new-${index}`} className="relative w-24 h-24 rounded-lg overflow-hidden border ring-2 ring-green-500">
                                <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => removeNewFile(index)}
                                    className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}

                        {/* Add Button */}
                        <label className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                            <Camera className="w-6 h-6 text-gray-400" />
                            <span className="text-xs text-gray-400 mt-1">추가</span>
                            <input
                                type="file"
                                multiple
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                        </label>
                    </div>
                </div>

                {/* Submit */}
                <div className="flex justify-end pt-4 border-t">
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading || !title.trim() || !content.trim()}
                        className="bg-[#1C4526] hover:bg-[#1C4526]/90 text-white px-8"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {mode === 'CREATE' ? '등록하기' : '수정 완료'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
