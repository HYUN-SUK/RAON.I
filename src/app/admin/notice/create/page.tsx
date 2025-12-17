'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCommunityStore } from '@/store/useCommunityStore';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Camera, X } from 'lucide-react';
import { communityService } from '@/services/communityService';
import { z } from 'zod';

// Zod Schema (Simplified for Notice)
const noticeSchema = z.object({
    title: z.string().min(1, '제목을 입력해주세요.'),
    content: z.string().min(1, '내용을 입력해주세요.'),
    images: z.array(z.any()).max(5, '사진은 최대 5장까지 업로드 가능합니다.'),
});

export default function AdminNoticeCreatePage() {
    const router = useRouter();
    const { createPost, isLoading: storeLoading } = useCommunityStore();
    const [localLoading, setLocalLoading] = useState(false);

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);

    const isLoading = storeLoading || localLoading;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            if (selectedFiles.length + newFiles.length > 5) {
                alert('사진은 최대 5장까지 추가할 수 있습니다.');
                return;
            }
            setSelectedFiles(prev => [...prev, ...newFiles]);
            const newUrls = newFiles.map(file => URL.createObjectURL(file));
            setPreviewUrls(prev => [...prev, ...newUrls]);
        }
    };

    const removeImage = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
        setPreviewUrls(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const validation = noticeSchema.safeParse({ title, content, images: selectedFiles });
        if (!validation.success) {
            alert(validation.error.issues[0].message);
            return;
        }

        try {
            setLocalLoading(true);

            // 1. Upload Images
            const uploadedImageUrls: string[] = [];
            if (selectedFiles.length > 0) {
                const uploadPromises = selectedFiles.map(file => communityService.uploadImage(file));
                const results = await Promise.all(uploadPromises);
                uploadedImageUrls.push(...results);
            }

            // 2. Create Post
            await createPost({
                type: 'NOTICE',
                title,
                content,
                author: '관리자', // Fixed to Admin for Notices
                images: uploadedImageUrls,
                status: 'OPEN',
                visibility: 'PUBLIC',
            });

            // Redirect to Admin Notice List
            router.push('/admin/notice');
        } catch (error: any) {
            console.error('Submit Error:', error);
            alert(`공지 등록 중 오류가 발생했습니다.\n${error.message}`);
        } finally {
            setLocalLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center space-x-4">
                <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-2xl font-bold text-gray-800">공지사항 작성</h2>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border space-y-6">
                {/* Title */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                    <Input
                        placeholder="공지 제목을 입력하세요"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="text-lg"
                    />
                </div>

                {/* Content */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                    <Textarea
                        placeholder="공지 내용을 입력하세요"
                        className="min-h-[300px] resize-none text-base leading-relaxed"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                    />
                </div>

                {/* Images */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">사진 첨부 ({selectedFiles.length}/5)</label>
                    <div className="flex flex-wrap gap-3">
                        {previewUrls.map((url, index) => (
                            <div key={index} className="relative w-24 h-24 rounded-lg overflow-hidden border">
                                <img src={url} alt="preview" className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => removeImage(index)}
                                    className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
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
                        등록하기
                    </Button>
                </div>
            </div>
        </div>
    );
}
