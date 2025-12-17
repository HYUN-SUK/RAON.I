'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useCommunityStore } from '@/store/useCommunityStore';
import { communityService } from '@/services/communityService';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Camera, X } from 'lucide-react';
import { z } from 'zod';

// Reuse Schema
const noticeSchema = z.object({
    title: z.string().min(1, '제목을 입력해주세요.'),
    content: z.string().min(1, '내용을 입력해주세요.'),
    images: z.array(z.any()).max(5, '사진은 최대 5장까지 업로드 가능합니다.'),
});

export default function AdminNoticeDetailPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const { updatePost, isLoading: storeLoading } = useCommunityStore();
    const [localLoading, setLocalLoading] = useState(false);
    const [fetchLoading, setFetchLoading] = useState(true);

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [status, setStatus] = useState<'OPEN' | 'CLOSED'>('OPEN');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [existingImages, setExistingImages] = useState<string[]>([]);

    useEffect(() => {
        if (id) {
            loadNoticeData();
        }
    }, [id]);

    const loadNoticeData = async () => {
        try {
            setFetchLoading(true);
            const post = await communityService.getPostById(id);
            setTitle(post.title);
            setContent(post.content);
            setStatus(post.status === 'CLOSED' ? 'CLOSED' : 'OPEN');
            setExistingImages(post.images || []);
            setPreviewUrls(post.images || []);
        } catch (error) {
            console.error('Failed to load post', error);
            alert('공지사항을 불러오지 못했습니다.');
            router.back();
        } finally {
            setFetchLoading(false);
        }
    };

    const isLoading = storeLoading || localLoading || fetchLoading;

    // Handle File logic (Similar to create, but mixed with existing URLs is tricky)
    // For simplicity, we'll just append new files and keep existing URLs unless removed.
    // NOTE: This simple implementation might re-upload things if logic is complex. 
    // Let's separate "Existing URLs" and "New Files".
    // Actually, updatePost accepts string[] for images. 
    // We need to upload new files, get URLs, and combine with remaining Existing URLs.

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

        // Combined images for validation count
        const totalImageCount = existingImages.length + selectedFiles.length;
        if (totalImageCount > 5) {
            alert('사진은 최대 5장까지입니다.');
            return;
        }

        if (!title.trim() || !content.trim()) {
            alert('제목과 내용을 입력해주세요.');
            return;
        }

        try {
            setLocalLoading(true);

            // 1. Upload New Images
            const newImageUrls: string[] = [];
            if (selectedFiles.length > 0) {
                const uploadPromises = selectedFiles.map(file => communityService.uploadImage(file));
                const results = await Promise.all(uploadPromises);
                newImageUrls.push(...results);
            }

            // 2. Combine URLs
            const finalImages = [...existingImages, ...newImageUrls];

            // 3. Update Post
            await updatePost(id, {
                title,
                content,
                images: finalImages,
                status,
                visibility: status === 'CLOSED' ? 'PRIVATE' : 'PUBLIC', // Sync visibility
            });

            alert('공지가 수정되었습니다.');
            router.push('/admin/notice');
        } catch (error: any) {
            console.error('Update Error:', error);
            alert(`수정 중 오류가 발생했습니다.\n${error.message}`);
        } finally {
            setLocalLoading(false);
        }
    };

    if (fetchLoading) {
        return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-2xl font-bold text-gray-800">공지사항 수정</h2>
                </div>
                {/* Status Toggle on Detail Page as well */}
                <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {status === 'OPEN' ? '노출 중' : '노출 중지'}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStatus(prev => prev === 'OPEN' ? 'CLOSED' : 'OPEN')}
                    >
                        상태 변경
                    </Button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border space-y-6">
                {/* Title */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                    <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="text-lg"
                    />
                </div>

                {/* Content */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                    <Textarea
                        className="min-h-[300px] resize-none text-base leading-relaxed"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                    />
                </div>

                {/* Images */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">사진 첨부 ({existingImages.length + selectedFiles.length}/5)</label>
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
                        disabled={isLoading}
                        className="bg-[#1C4526] hover:bg-[#1C4526]/90 text-white px-8"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        수정 완료
                    </Button>
                </div>
            </div>
        </div>
    );
}
