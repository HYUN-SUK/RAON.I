'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { BoardType, useCommunityStore } from '@/store/useCommunityStore';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, Camera, X } from 'lucide-react';
import { communityService } from '@/services/communityService';
import { z } from 'zod';
import { dispatchPersonaAction } from '@/lib/persona';

const CATEGORIES: { id: BoardType; label: string }[] = [
    // NOTICE removed (Admin only)
    { id: 'REVIEW', label: '후기' },
    { id: 'STORY', label: '이야기' },
    { id: 'QNA', label: '질문, 오류신고' },
    // { id: 'GROUP', label: '소모임' },
    // { id: 'CONTENT', label: '콘텐츠' }, // Use dedicated Creator Page
];

const VISIBILITY_OPTIONS = [
    { value: 'PUBLIC', label: '전체 공개' },
    { value: 'FRIENDS', label: '친구만 공개' },
    { value: 'PRIVATE', label: '비공개' },
];

// Zod Schema
const postSchema = z.object({
    title: z.string().min(1, '제목을 입력해주세요.'),
    content: z.string().min(1, '내용을 입력해주세요.'),
    type: z.enum(['NOTICE', 'REVIEW', 'STORY', 'QNA', 'GROUP', 'CONTENT']),
    images: z.array(z.custom<File>((val) => val instanceof File, "파일 형식이 올바르지 않습니다."))
        .max(5, '사진은 최대 5장까지 업로드 가능합니다.'),
});

import ImageEditorModal from '@/components/record/ImageEditorModal';

export default function CommunityWriteForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialType = (searchParams.get('type') as BoardType) || 'STORY';

    const { createPost, isLoading: storeLoading, currentUser } = useCommunityStore();
    const [localLoading, setLocalLoading] = useState(false);

    const [type, setType] = useState<BoardType>(initialType);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [visibility, setVisibility] = useState('PUBLIC');

    // Auto-set visibility based on Board Type
    React.useEffect(() => {
        if (type === 'STORY') {
            setVisibility('PRIVATE');
        } else {
            setVisibility('PUBLIC');
        }
    }, [type]);

    // Extra fields
    const [groupName, setGroupName] = useState('');
    const [videoUrl, setVideoUrl] = useState('');

    // Image Upload State
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);

    // Editor State
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [tempImage, setTempImage] = useState<string | null>(null);

    const isLoading = storeLoading || localLoading;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);

            // Validation: Max 5 images total
            if (selectedFiles.length + newFiles.length > 5) {
                alert('사진은 최대 5장까지 추가할 수 있습니다.');
                return;
            }

            // Validation: 5MB size limit per file
            const oversizedFiles = newFiles.filter(file => file.size > 5 * 1024 * 1024);
            if (oversizedFiles.length > 0) {
                alert('이미지 파일 크기는 장당 5MB를 초과할 수 없습니다.');
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

    const handleEditClick = (index: number) => {
        setTempImage(previewUrls[index]);
        setEditingIndex(index);
        setIsEditorOpen(true);
    };

    const handleEditorSave = async (dataUrl: string) => {
        if (editingIndex === null) return;

        // Convert Data URL to File
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const originalFile = selectedFiles[editingIndex];
        const file = new File([blob], originalFile.name, { type: "image/png" });

        // Update State
        const newFiles = [...selectedFiles];
        newFiles[editingIndex] = file;
        setSelectedFiles(newFiles);

        const newUrls = [...previewUrls];
        newUrls[editingIndex] = dataUrl;
        setPreviewUrls(newUrls);

        setIsEditorOpen(false);
        setEditingIndex(null);
        setTempImage(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); // Crucial

        // Validation: Content Length
        if (content.length > 3000) {
            alert('내용은 3,000자 이내로 작성해주세요.');
            return;
        }

        // Zod Validation
        const validation = postSchema.safeParse({ type, title, content, images: selectedFiles });
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
                type,
                title,
                content,
                author: currentUser.name, // Use name from store
                images: uploadedImageUrls,
                groupName: type === 'GROUP' ? groupName : undefined,
                videoUrl: type === 'CONTENT' ? videoUrl : undefined,
                visibility: visibility as 'PUBLIC' | 'FRIENDS' | 'PRIVATE',
            });

            // --- [Phase 3.5] Progressive Trigger Injection: Community Posting ---
            if (currentUser?.id) {
                const combinedText = `${title} ${content}`.toLowerCase();

                // Keyword analysis for Persona Tags
                if (combinedText.includes('불멍') || combinedText.includes('장작') || combinedText.includes('화로')) {
                    await dispatchPersonaAction(currentUser.id, 'FEED_POST_FIRE');
                }
                if (combinedText.includes('요리') || combinedText.includes('바베큐') || combinedText.includes('밀키트') || combinedText.includes('먹방')) {
                    await dispatchPersonaAction(currentUser.id, 'FEED_POST_FOOD');
                }
                if (combinedText.includes('별') || combinedText.includes('밤하늘') || combinedText.includes('은하수')) {
                    await dispatchPersonaAction(currentUser.id, 'FEED_POST_STAR');
                }
                if (combinedText.includes('우중') || combinedText.includes('비오는')) {
                    await dispatchPersonaAction(currentUser.id, 'FEED_POST_RAIN');
                }
                if (combinedText.includes('설중') || combinedText.includes('눈오는') || combinedText.includes('눈싸움')) {
                    await dispatchPersonaAction(currentUser.id, 'FEED_POST_SNOW');
                }

                // Group / Market related intent from Community feed
                if (type === 'GROUP' || combinedText.includes('나눔')) {
                    if (combinedText.includes('장비') || combinedText.includes('텐트') || combinedText.includes('랜턴')) {
                        await dispatchPersonaAction(currentUser.id, 'FEED_DONATE_GEAR');
                    } else if (combinedText.includes('나눔') || combinedText.includes('음식')) {
                        await dispatchPersonaAction(currentUser.id, 'FEED_DONATE_FOOD');
                    }
                }
            }

            // Go back to list
            router.back();
        } catch (error) {
            console.error('Submit Error:', error);
            alert(`글 작성 중 오류가 발생했습니다.\n${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setLocalLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white pb-48">
            {/* Header */}
            <div className="flex items-center h-[56px] px-4 border-b">
                <button onClick={() => router.back()} className="mr-4">
                    <ArrowLeft className="w-6 h-6 text-[#1A1A1A]" />
                </button>
                <h1 className="text-lg font-bold text-[#1A1A1A]">글쓰기</h1>
            </div>

            {/* Form */}
            <div className="p-5 space-y-5">
                {/* Board & Visibility Row */}
                <div className="flex gap-3">
                    <div className="flex-1 space-y-1">
                        <label className="text-xs font-medium text-[#999]">게시판</label>
                        <Select value={type} onValueChange={(val) => setType(val as BoardType)}>
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder="게시판" />
                            </SelectTrigger>
                            <SelectContent>
                                {CATEGORIES.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex-1 space-y-1">
                        <label className="text-xs font-medium text-[#999]">공개 범위</label>
                        <Select value={visibility} onValueChange={setVisibility}>
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder="공개 범위" />
                            </SelectTrigger>
                            <SelectContent>
                                {VISIBILITY_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Privacy Guide for Story (Top) */}
                {type === 'STORY' && (
                    <div className="p-3 bg-[#FDFBF7] border border-[#ECE8DF] rounded-lg text-xs text-stone-600 leading-relaxed flex items-center gap-2">
                        <span className="text-lg">🔒</span>
                        <div>
                            <span className="font-bold text-[#1C4526]">기본 비공개</span>로 설정되며 작성자만 볼 수 있습니다.<br />
                            전체 공개 시 이야기 게시판에 게시됩니다.
                        </div>
                    </div>
                )}

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

                {/* Content - Reduced Height */}
                <Textarea
                    placeholder="캠퍼들과 나누고 싶은 이야기를 적어주세요."
                    className="min-h-[200px] resize-none border-none px-0 shadow-none focus-visible:ring-0 text-base placeholder:text-[#999] leading-relaxed"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                />

                {/* Image Previews */}
                {previewUrls.length > 0 && (
                    <div className="flex gap-3 overflow-x-auto pb-2">
                        {previewUrls.map((url, index) => (
                            <div key={index} className="relative aspect-square rounded-md overflow-hidden border border-border">
                                <img
                                    src={url}
                                    alt={`Preview ${index}`}
                                    className="w-full h-full object-cover cursor-pointer"
                                    onClick={() => handleEditClick(index)}
                                />
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeImage(index);
                                    }}
                                    className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 hover:bg-black/70 transition-colors"
                                >
                                    <X size={14} />
                                </button>
                                {/* Edit Hint Overlay */}
                                <div
                                    className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none"
                                >
                                    <span className="text-white text-xs font-medium bg-black/40 px-2 py-1 rounded-full backdrop-blur-sm">편집</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

            </div>

            {/* Bottom Actions */}
            <div className="fixed bottom-[80px] left-0 right-0 max-w-[430px] mx-auto p-4 border-t bg-white flex justify-between items-center z-50">
                <label className="cursor-pointer flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors">
                    <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileSelect}
                    />
                    <div className="w-8 h-8 rounded-full bg-[#F7F5EF] flex items-center justify-center text-[#1C4526]">
                        <Camera className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium text-[#4D4D4D]">{selectedFiles.length}/5</span>
                </label>

                <Button
                    onClick={handleSubmit}
                    disabled={isLoading || !title.trim() || !content.trim()}
                    className="bg-[#1C4526] hover:bg-[#1C4526]/90 text-white rounded-full px-6 text-md font-bold shadow-lg"
                >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '올리기'}
                </Button>
            </div>
            {/* Image Editor Modal */}
            {tempImage && isEditorOpen && (
                <ImageEditorModal
                    isOpen={isEditorOpen}
                    onClose={() => setIsEditorOpen(false)}
                    imagePath={tempImage}
                    onSave={handleEditorSave}
                />
            )}
        </div>
    );
}
