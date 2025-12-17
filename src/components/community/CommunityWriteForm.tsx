'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BoardType, useCommunityStore } from '@/store/useCommunityStore';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, Camera, X } from 'lucide-react';
import { communityService } from '@/services/communityService';

const CATEGORIES: { id: BoardType; label: string }[] = [
    { id: 'NOTICE', label: '공지 (관리자)' },
    { id: 'REVIEW', label: '후기' },
    { id: 'STORY', label: '이야기' },
    { id: 'QNA', label: '질문' },
    { id: 'GROUP', label: '소모임' },
    { id: 'CONTENT', label: '콘텐츠' },
];

export default function CommunityWriteForm() {
    const router = useRouter();
    const { createPost, isLoading } = useCommunityStore();

    const [type, setType] = useState<BoardType>('STORY');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    // Extra fields
    const [groupName, setGroupName] = useState('');
    const [videoUrl, setVideoUrl] = useState('');

    // Image Upload State
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
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
        if (!title.trim() || !content.trim()) return;

        try {
            // 1. Upload Images
            const uploadedImageUrls: string[] = [];
            if (selectedFiles.length > 0) {
                // Upload sequentially or parallel? Parallel is faster.
                const uploadPromises = selectedFiles.map(file => communityService.uploadImage(file));
                const results = await Promise.all(uploadPromises);
                uploadedImageUrls.push(...results);
            }

            // 2. Create Post
            await createPost({
                type,
                title,
                content,
                // Mock author for now
                author: 'Current User',
                images: uploadedImageUrls,
                groupName: type === 'GROUP' ? groupName : undefined,
                videoUrl: type === 'CONTENT' ? videoUrl : undefined,
            });

            // Go back to list
            router.back();
        } catch (error: any) {
            console.error('Submit Error:', error);
            alert(`Error: ${error.message || JSON.stringify(error)}\n\nDetails: ${JSON.stringify(error, null, 2)}`);
        }
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Header */}
            <div className="flex items-center h-[56px] px-4 border-b">
                <button onClick={() => router.back()} className="mr-4">
                    <ArrowLeft className="w-6 h-6 text-[#1A1A1A]" />
                </button>
                <h1 className="text-lg font-bold text-[#1A1A1A]">글쓰기</h1>
                <Button
                    onClick={handleSubmit}
                    disabled={isLoading || !title || !content}
                    variant="ghost"
                    className="ml-auto text-[#1C4526] font-bold"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '완료'}
                </Button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-6">
                {/* Category Select */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-[#4D4D4D]">게시판 선택</label>
                    <Select value={type} onValueChange={(val) => setType(val as BoardType)}>
                        <SelectTrigger>
                            <SelectValue placeholder="게시판을 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                            {CATEGORIES.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Dynamic Fields */}
                {type === 'GROUP' && (
                    <Input
                        placeholder="소모임 이름 (예: 찰칵)"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                    />
                )}
                {type === 'CONTENT' && (
                    <Input
                        placeholder="영상 URL 입력 (Youtube...)"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                    />
                )}

                {/* Title */}
                <Input
                    placeholder="제목을 입력하세요"
                    className="text-lg font-medium border-none px-0 shadow-none focus-visible:ring-0 placeholder:text-[#999]"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />

                {/* Content */}
                <Textarea
                    placeholder="캠퍼들과 나누고 싶은 이야기를 적어주세요."
                    className="min-h-[300px] resize-none border-none px-0 shadow-none focus-visible:ring-0 text-base placeholder:text-[#999]"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                />

                {/* Image Previews */}
                {previewUrls.length > 0 && (
                    <div className="flex gap-3 overflow-x-auto pb-2">
                        {previewUrls.map((url, index) => (
                            <div key={index} className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 border border-gray-100">
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
                    </div>
                )}

                {/* Footer Toolbar */}
                <div className="border-t pt-4 flex gap-4">
                    <label className="cursor-pointer flex items-center gap-2 text-gray-500 hover:text-[#1C4526]">
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                        <Camera className="w-6 h-6" />
                        <span className="text-sm">사진 추가</span>
                    </label>
                </div>
            </form>
        </div>
    );
}
