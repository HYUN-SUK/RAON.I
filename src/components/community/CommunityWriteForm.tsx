'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { BoardType, useCommunityStore } from '@/store/useCommunityStore';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, Camera, X, Pencil, Sparkles } from 'lucide-react';
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
import { createClient } from '@/lib/supabase-client';

export default function CommunityWriteForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialType = (searchParams.get('type') as BoardType) || 'STORY';

    const { createPost, isLoading: storeLoading, currentUser } = useCommunityStore();
    const [localLoading, setLocalLoading] = useState(false);
    const editId = searchParams.get('editId');

    const [type, setType] = useState<BoardType>(initialType);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [visibility, setVisibility] = useState('PUBLIC');
    const [isAdmin, setIsAdmin] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [authorName, setAuthorName] = useState<string>('캠퍼');
    const [existingImages, setExistingImages] = useState<string[]>([]);
    const [isEditLoading, setIsEditLoading] = useState<boolean>(!!editId);

    // [v11.9.95] 권한 확인 및 수정 모드 데이터 로드
    React.useEffect(() => {
        const checkUserAndLoad = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            let loggedInUserId: string | null = null;
            let adminCheck = false;

            if (user) {
                loggedInUserId = user.id;
                setCurrentUserId(user.id);
                const resolvedName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || '캠퍼';
                setAuthorName(resolvedName);

                adminCheck = user.email === 'admin@raon.ai' || user.user_metadata?.role === 'admin' || user.app_metadata?.role === 'admin';
                setIsAdmin(adminCheck);

                if (!adminCheck && initialType === 'NOTICE' && !editId) {
                    setType('STORY');
                }
            } else {
                if (initialType === 'NOTICE' && !editId) {
                    setType('STORY');
                }
            }

            // 수정 모드일 때 기존 게시글 정보 로드
            if (editId) {
                try {
                    const post = await communityService.getPostById(editId);
                    if (post) {
                        // 작성자 본인이 아니면 수정 진입 불가
                        if (post.authorId && post.authorId !== loggedInUserId) {
                            alert('본인이 작성한 글만 수정할 수 있습니다.');
                            router.back();
                            return;
                        }
                        setTitle(post.title);
                        setContent(post.content);
                        setType(post.type);
                        if (post.visibility) setVisibility(post.visibility);
                        if (post.groupName) setGroupName(post.groupName);
                        if (post.videoUrl) setVideoUrl(post.videoUrl);
                        if (post.images && post.images.length > 0) {
                            setExistingImages(post.images);
                            setPreviewUrls(post.images);
                        }
                    } else {
                        alert('게시글을 찾을 수 없습니다.');
                        router.back();
                    }
                } catch (err) {
                    console.error('Failed to load post for edit:', err);
                } finally {
                    setIsEditLoading(false);
                }
            }
        };
        checkUserAndLoad();
    }, [initialType, editId, router]);

    // Auto-set visibility based on Board Type
    React.useEffect(() => {
        if (!editId) {
            if (type === 'STORY' || type === 'QNA') {
                setVisibility('PRIVATE');
            } else {
                setVisibility('PUBLIC');
            }
        }
    }, [type, editId]);

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

    const isLoading = storeLoading || localLoading || isEditLoading;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);

            // Validation: Max 5 images total (existing + selected)
            if (existingImages.length + selectedFiles.length + newFiles.length > 5) {
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
        if (index < existingImages.length) {
            setExistingImages(prev => prev.filter((_, i) => i !== index));
            setPreviewUrls(prev => prev.filter((_, i) => i !== index));
        } else {
            const fileIndex = index - existingImages.length;
            setSelectedFiles(prev => prev.filter((_, i) => i !== fileIndex));
            setPreviewUrls(prev => prev.filter((_, i) => i !== index));
        }
    };

    const handleEditClick = (index: number) => {
        setTempImage(previewUrls[index]);
        setEditingIndex(index);
        setIsEditorOpen(true);
    };

    const handleEditorSave = async (dataUrl: string) => {
        if (editingIndex === null) return;

        // If editing an existing remote image URL
        if (editingIndex < existingImages.length) {
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const file = new File([blob], `edited_${editingIndex}.png`, { type: "image/png" });

            // Upload directly to get updated URL
            try {
                const uploadedUrl = await communityService.uploadImage(file);
                setExistingImages(prev => {
                    const next = [...prev];
                    next[editingIndex] = uploadedUrl;
                    return next;
                });
                setPreviewUrls(prev => {
                    const next = [...prev];
                    next[editingIndex] = uploadedUrl;
                    return next;
                });
            } catch (err) {
                console.error("Editor Save Upload Error:", err);
            }
        } else {
            const fileIndex = editingIndex - existingImages.length;
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const originalFile = selectedFiles[fileIndex];
            const file = new File([blob], originalFile?.name || `edited_${fileIndex}.png`, { type: "image/png" });

            const newFiles = [...selectedFiles];
            newFiles[fileIndex] = file;
            setSelectedFiles(newFiles);

            const newUrls = [...previewUrls];
            newUrls[editingIndex] = dataUrl;
            setPreviewUrls(newUrls);
        }

        setIsEditorOpen(false);
        setEditingIndex(null);
        setTempImage(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); // Crucial

        if (content.length > 3000) {
            alert('내용은 3,000자 이내로 작성해주세요.');
            return;
        }

        if (!title.trim()) {
            alert('제목을 입력해주세요.');
            return;
        }

        if (!content.trim()) {
            alert('내용을 입력해주세요.');
            return;
        }

        try {
            setLocalLoading(true);

            if (editId) {
                // 1. Upload newly selected files
                const newUploadedUrls: string[] = [];
                if (selectedFiles.length > 0) {
                    const uploadPromises = selectedFiles.map(file => communityService.uploadImage(file));
                    const results = await Promise.all(uploadPromises);
                    newUploadedUrls.push(...results);
                }

                const finalImages = [...existingImages, ...newUploadedUrls];

                // 2. Update existing post
                await communityService.updatePost(editId, {
                    type,
                    title,
                    content,
                    images: finalImages,
                    groupName: type === 'GROUP' ? groupName : undefined,
                    videoUrl: type === 'CONTENT' ? videoUrl : undefined,
                    visibility: visibility as 'PUBLIC' | 'FRIENDS' | 'PRIVATE',
                });

                alert('게시글이 수정되었습니다.');
                router.push(`/community/${editId}`);
            } else {
                // 1. Upload Images for new post
                const uploadedImageUrls: string[] = [];
                if (selectedFiles.length > 0) {
                    const uploadPromises = selectedFiles.map(file => communityService.uploadImage(file));
                    const results = await Promise.all(uploadPromises);
                    uploadedImageUrls.push(...results);
                }

                // 2. Create Post with real author name and ID
                await createPost({
                    type,
                    title,
                    content,
                    author: authorName,
                    authorId: currentUserId || undefined,
                    images: uploadedImageUrls,
                    groupName: type === 'GROUP' ? groupName : undefined,
                    videoUrl: type === 'CONTENT' ? videoUrl : undefined,
                    visibility: visibility as 'PUBLIC' | 'FRIENDS' | 'PRIVATE',
                });

                // Persona Actions Trigger
                if (currentUserId) {
                    const combinedText = `${title} ${content}`.toLowerCase();

                    if (combinedText.includes('불멍') || combinedText.includes('장작') || combinedText.includes('화로')) {
                        await dispatchPersonaAction(currentUserId, 'FEED_POST_FIRE');
                    }
                    if (combinedText.includes('요리') || combinedText.includes('바베큐') || combinedText.includes('밀키트') || combinedText.includes('먹방')) {
                        await dispatchPersonaAction(currentUserId, 'FEED_POST_FOOD');
                    }
                    if (combinedText.includes('별') || combinedText.includes('밤하늘') || combinedText.includes('은하수')) {
                        await dispatchPersonaAction(currentUserId, 'FEED_POST_STAR');
                    }
                    if (combinedText.includes('우중') || combinedText.includes('비오는')) {
                        await dispatchPersonaAction(currentUserId, 'FEED_POST_RAIN');
                    }
                    if (combinedText.includes('설중') || combinedText.includes('눈오는') || combinedText.includes('눈싸움')) {
                        await dispatchPersonaAction(currentUserId, 'FEED_POST_SNOW');
                    }

                    if (type === 'GROUP' || combinedText.includes('나눔')) {
                        if (combinedText.includes('장비') || combinedText.includes('텐트') || combinedText.includes('랜턴')) {
                            await dispatchPersonaAction(currentUserId, 'FEED_DONATE_GEAR');
                        } else if (combinedText.includes('나눔') || combinedText.includes('음식')) {
                            await dispatchPersonaAction(currentUserId, 'FEED_DONATE_FOOD');
                        }
                    }
                }

                router.back();
            }
        } catch (error) {
            console.error('Submit Error:', error);
            alert(`처리 중 오류가 발생했습니다.\n${error instanceof Error ? error.message : 'Unknown error'}`);
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
                <h1 className="text-lg font-bold text-[#1A1A1A]">{editId ? '글수정' : '글쓰기'}</h1>
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
                                {isAdmin && (
                                    <SelectItem value="NOTICE">공지사항</SelectItem>
                                )}
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

                {/* Privacy Guide for Board Types (Top) */}
                {type === 'STORY' && (
                    <div className="p-3 bg-[#FDFBF7] border border-[#ECE8DF] rounded-lg text-xs text-stone-600 leading-relaxed flex items-center gap-2">
                        <span className="text-lg">🔒</span>
                        <div>
                            <span className="font-bold text-[#1C4526]">기본 비공개</span>로 설정되며 작성자만 볼 수 있습니다.<br />
                            전체 공개 시 이야기 게시판에 게시됩니다.
                        </div>
                    </div>
                )}

                {type === 'REVIEW' && visibility === 'PRIVATE' && (
                    <div className="p-3 bg-[#FDFBF7] border border-[#ECE8DF] rounded-lg text-xs text-stone-600 leading-relaxed flex items-center gap-2">
                        <span className="text-lg">🔒</span>
                        <div>
                            후기 글이 <span className="font-bold text-[#1C4526]">비공개</span>로 작성됩니다.<br />
                            비공개 후기는 <span className="font-bold text-stone-800">작성자 본인만</span> 조회할 수 있습니다.
                        </div>
                    </div>
                )}

                {type === 'QNA' && visibility === 'PRIVATE' && (
                    <div className="p-3 bg-[#FDFBF7] border border-[#ECE8DF] rounded-lg text-xs text-stone-600 leading-relaxed flex items-center gap-2">
                        <span className="text-lg">🔒</span>
                        <div>
                            질문, 오류신고 글이 <span className="font-bold text-[#1C4526]">비공개</span>로 작성됩니다.<br />
                            비공개 글은 <span className="font-bold text-stone-800">작성자와 관리자만</span> 조회할 수 있습니다.
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
                            <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-stone-200 shadow-sm group min-w-[160px] w-[160px] h-[160px]">
                                <img
                                    src={url}
                                    alt={`Preview ${index}`}
                                    className="w-full h-full object-cover cursor-pointer"
                                    onClick={() => handleEditClick(index)}
                                />
                                {/* Delete Button (Enlarged X button with 2x touch area) */}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeImage(index);
                                    }}
                                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-2 shadow-md ring-2 ring-white/90 transition-all active:scale-95 z-20"
                                    title="사진 삭제"
                                >
                                    <X size={20} className="w-5 h-5 stroke-[2.5]" />
                                </button>
                                {/* Edit Hint Overlay (Enlarged Glowing Pulse Badge with Pencil & Sparkles) */}
                                <div
                                    onClick={() => handleEditClick(index)}
                                    className="absolute inset-0 bg-black/25 flex items-center justify-center cursor-pointer transition-colors hover:bg-black/35 z-10"
                                >
                                    <div className="flex items-center gap-1.5 bg-[#1C4526] text-white text-sm font-bold px-3.5 py-1.5 rounded-full shadow-lg ring-2 ring-emerald-300/80 animate-pulse backdrop-blur-sm">
                                        <Pencil size={15} className="w-4 h-4 text-emerald-200" />
                                        <span>편집</span>
                                        <Sparkles size={13} className="w-3.5 h-3.5 text-yellow-300" />
                                    </div>
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
