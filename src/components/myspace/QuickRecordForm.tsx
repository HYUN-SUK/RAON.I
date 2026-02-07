'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, X, Loader2, Sparkles, Send, Check, Edit3, Globe, Lock, MapPin, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button'; // @ts-ignore
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { createRecord, uploadRecordImage, getScheduleForRecord, getVisitCount } from '@/actions/record';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import dynamic from 'next/dynamic';

// 동적 import (SSR 비활성화)
const ImageEditorModal = dynamic(
    () => import('@/components/record/ImageEditorModal'),
    { ssr: false }
);

interface ScheduleInfo {
    id: string;
    title: string;
    campgroundName?: string;
    campgroundAddress?: string;
    latitude?: number;
    longitude?: number;
    isRaonai: boolean;
    startDate: string;
    endDate: string;
}

interface QuickRecordFormProps {
    isOpen: boolean;
    onClose: () => void;
    scheduleId?: string;
    onSuccess?: () => void;
}

const MAX_CONTENT_LENGTH = 200;
const MAX_TAGS = 5;

// 표준 태그 Taxonomy (20개)
const STANDARD_TAGS = {
    분위기: [
        { key: '조용해요', emoji: '🤫' },
        { key: '뷰맛집', emoji: '🏔️' },
        { key: '프라이빗', emoji: '🔒' },
        { key: '가족친화', emoji: '👨‍👩‍👧‍👦' },
        { key: '힐링됨', emoji: '🧘' },
    ],
    시설: [
        { key: '샤워굿', emoji: '🚿' },
        { key: '전기굿', emoji: '⚡' },
        { key: '화장실깔끔', emoji: '🚻' },
        { key: '넓은사이트', emoji: '⛺' },
        { key: 'WiFi굿', emoji: '📶' },
    ],
    액티비티: [
        { key: '불멍최고', emoji: '🔥' },
        { key: '물놀이', emoji: '💦' },
        { key: '아이랑좋아요', emoji: '👶' },
        { key: '반려견환영', emoji: '🐕' },
        { key: '숲체험', emoji: '🌲' },
    ],
    기타: [
        { key: '가성비', emoji: '💰' },
        { key: '사장님친절', emoji: '😊' },
        { key: '음식맛집', emoji: '🍖' },
        { key: '재방문의사', emoji: '💕' },
        { key: '별보기좋음', emoji: '⭐' },
    ],
};

export default function QuickRecordForm({
    isOpen,
    onClose,
    scheduleId,
    onSuccess
}: QuickRecordFormProps) {
    const [content, setContent] = useState('');
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [isPublic, setIsPublic] = useState(false);
    const [scheduleInfo, setScheduleInfo] = useState<ScheduleInfo | null>(null);

    // New Fields
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');

    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 일정 정보 로드 및 자동완성
    useEffect(() => {
        if (scheduleId && isOpen) {
            getScheduleForRecord(scheduleId).then(async info => {
                setScheduleInfo(info);

                if (info) {
                    const baseName = info.campgroundName || info.title;
                    const baseAddr = info.campgroundAddress || '';

                    setAddress(baseAddr);

                    // 방문 횟수 체크 (동일 이름)
                    if (baseName) {
                        const count = await getVisitCount(baseName);
                        if (count > 0) {
                            setName(`${baseName} (${count + 1})`);
                        } else {
                            setName(baseName);
                        }
                    } else {
                        setName('');
                    }

                    // 라온아이 캠핑장이면 기본 공개
                    if (info.isRaonai) {
                        setIsPublic(true);
                    }
                }
            });
        } else {
            setScheduleInfo(null);
            setName('');
            setAddress('');
        }
    }, [scheduleId, isOpen]);

    // 태그 토글
    const handleTagToggle = (tag: string) => {
        setSelectedTags(prev => {
            if (prev.includes(tag)) {
                return prev.filter(t => t !== tag);
            }
            if (prev.length >= MAX_TAGS) {
                toast.error(`태그는 최대 ${MAX_TAGS}개까지 선택할 수 있어요`);
                return prev;
            }
            return [...prev, tag];
        });
    };

    // 사진 선택
    const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 파일 크기 체크 (5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('사진 크기는 5MB 이하만 가능해요');
            return;
        }

        // 미리보기 생성
        const reader = new FileReader();
        reader.onloadend = () => {
            setPhotoPreview(reader.result as string);
        };
        reader.readAsDataURL(file);

        // 업로드
        setIsUploading(true);
        try {
            const result = await uploadRecordImage(file);
            if (result.success && result.url) {
                setPhotoUrl(result.url);
                toast.success('사진이 업로드되었어요');
            } else {
                toast.error(result.error || '업로드 실패');
                setPhotoPreview(null);
            }
        } catch {
            toast.error('업로드 중 오류가 발생했어요');
            setPhotoPreview(null);
        } finally {
            setIsUploading(false);
        }
    };

    // 사진 삭제
    const handleRemovePhoto = () => {
        setPhotoUrl(null);
        setPhotoPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // 편집된 이미지 저장
    const handleEditedImageSave = async (dataUrl: string) => {
        // Data URL을 Blob으로 변환
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], `edited-${Date.now()}.png`, { type: 'image/png' });

        setIsUploading(true);
        try {
            const result = await uploadRecordImage(file);
            if (result.success && result.url) {
                setPhotoUrl(result.url);
                setPhotoPreview(dataUrl);
                toast.success('편집된 사진이 저장되었어요');
            } else {
                toast.error(result.error || '저장 실패');
            }
        } catch {
            toast.error('저장 중 오류가 발생했어요');
        } finally {
            setIsUploading(false);
        }
    };

    // 제출
    const handleSubmit = async () => {
        if (!content.trim() && !photoUrl && selectedTags.length === 0) {
            toast.error('내용, 사진, 또는 태그를 추가해주세요');
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await createRecord({
                scheduleId,
                content: content.trim(),
                photoUrl: photoUrl || undefined,
                tags: selectedTags,
                isPublic,
                campgroundType: scheduleInfo?.isRaonai ? 'raonai' : 'external',
                campgroundName: name, // User input name
                campgroundAddress: address, // User input address
                latitude: scheduleInfo?.latitude,
                longitude: scheduleInfo?.longitude,
            });

            if (result.success) {
                toast.success('기록이 저장되었어요! ✨');
                setContent('');
                setPhotoUrl(null);
                setPhotoPreview(null);
                setSelectedTags([]);
                setIsPublic(false);
                onSuccess?.();
                onClose();
            } else {
                toast.error(result.error || '저장 실패');
            }
        } catch {
            toast.error('오류가 발생했어요');
        } finally {
            setIsSubmitting(false);
        }
    };

    // 폼 리셋
    const handleClose = () => {
        setContent('');
        setPhotoUrl(null);
        setPhotoPreview(null);
        setSelectedTags([]);
        setIsPublic(false);
        setScheduleInfo(null);
        onClose();
    };

    return (
        <>
            <Sheet open={isOpen} onOpenChange={handleClose}>
                <SheetContent
                    side="bottom"
                    className="rounded-t-3xl max-h-[85vh] overflow-y-auto"
                    onInteractOutside={(e) => {
                        // 이미지 에디터가 열려있을 때 외부 클릭으로 Sheet 닫히는 것 방지
                        if (isEditorOpen) {
                            e.preventDefault();
                        }
                    }}
                    onPointerDownOutside={(e) => {
                        // 이미지 에디터가 열려있을 때 포인터 다운으로 Sheet 닫히는 것 방지
                        if (isEditorOpen) {
                            e.preventDefault();
                        }
                    }}
                >
                    <SheetHeader className="pb-3 border-b border-gray-100">
                        <SheetTitle className="flex items-center gap-2 text-[#224732]">
                            <Sparkles className="w-5 h-5" />
                            1분 기록
                        </SheetTitle>
                    </SheetHeader>

                    <div className="py-4 space-y-4">
                        {/* 일정 정보 표시 */}
                        {/* 일정 정보 입력 필드 (Auto-filled but editable) */}
                        <div className="space-y-3 bg-stone-50 p-3 rounded-xl border border-stone-100">
                            <div>
                                <label className="text-xs font-semibold text-stone-500 mb-1 block flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> 캠핑장
                                </label>
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="캠핑장 이름"
                                    className="bg-white h-9 text-sm font-medium text-[#224732]"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-stone-500 mb-1 block flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> 주소
                                </label>
                                <Input
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="캠핑장 주소"
                                    className="bg-white h-9 text-xs text-stone-600 truncate"
                                />
                            </div>

                            {scheduleInfo && (
                                <div className="flex items-center gap-2 text-xs text-stone-400 pt-1">
                                    <Calendar className="w-3 h-3" />
                                    <span>
                                        {format(new Date(scheduleInfo.startDate), 'M월 d일', { locale: ko })}
                                        {scheduleInfo.startDate !== scheduleInfo.endDate &&
                                            ` ~ ${format(new Date(scheduleInfo.endDate), 'M월 d일', { locale: ko })}`
                                        }
                                        의 기록
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* 공개/비공개 토글 */}
                        <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                            <div className="flex items-center gap-2">
                                {isPublic ? (
                                    <Globe className="w-4 h-4 text-[#224732]" />
                                ) : (
                                    <Lock className="w-4 h-4 text-gray-500" />
                                )}
                                <span className="text-sm font-medium">
                                    {isPublic ? '후기게시판에 공개' : '나만 보기'}
                                </span>
                            </div>
                            <Switch
                                checked={isPublic}
                                onCheckedChange={setIsPublic}
                                className="data-[state=checked]:bg-[#224732]"
                            />
                        </div>

                        {/* 사진 영역 */}
                        <div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoSelect}
                                className="hidden"
                            />

                            {photoPreview ? (
                                <div className="relative">
                                    <img
                                        src={photoPreview}
                                        alt="미리보기"
                                        className="w-full h-48 object-cover rounded-xl"
                                    />
                                    {isUploading && (
                                        <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                                            <Loader2 className="w-8 h-8 text-white animate-spin" />
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2 flex gap-2 z-10">
                                        <button
                                            onClick={() => setIsEditorOpen(true)}
                                            className="w-9 h-9 flex items-center justify-center bg-[#224732] rounded-full hover:bg-[#1a3626] transition-colors shadow-lg"
                                            disabled={isUploading}
                                            aria-label="사진 편집"
                                        >
                                            <Edit3 className="w-4 h-4 text-white" />
                                        </button>
                                        <button
                                            onClick={handleRemovePhoto}
                                            className="w-9 h-9 flex items-center justify-center bg-black/70 rounded-full hover:bg-black/90 transition-colors shadow-lg"
                                            disabled={isUploading}
                                            aria-label="사진 삭제"
                                        >
                                            <X className="w-4 h-4 text-white" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full h-28 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-[#224732] hover:bg-[#224732]/5 transition-colors"
                                >
                                    <Camera className="w-7 h-7 text-gray-400" />
                                    <span className="text-sm text-gray-500">사진 추가하기</span>
                                </button>
                            )}
                        </div>

                        {/* 메모 영역 */}
                        <div>
                            <Textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value.slice(0, MAX_CONTENT_LENGTH))}
                                placeholder="캠핑 경험을 자유롭게 적어주세요..."
                                className="min-h-[100px] resize-none border-gray-200 focus:border-[#224732] focus:ring-[#224732]"
                            />
                            <div className="text-right text-xs text-gray-400 mt-1">
                                {content.length}/{MAX_CONTENT_LENGTH}
                            </div>
                        </div>

                        {/* 태그 선택 영역 */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">태그 선택</span>
                                <span className="text-xs text-gray-400">{selectedTags.length}/{MAX_TAGS}</span>
                            </div>

                            {Object.entries(STANDARD_TAGS).map(([category, tags]) => (
                                <div key={category}>
                                    <p className="text-xs text-gray-500 mb-1.5">{category}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {tags.map(({ key, emoji }) => {
                                            const isSelected = selectedTags.includes(key);
                                            return (
                                                <button
                                                    key={key}
                                                    onClick={() => handleTagToggle(key)}
                                                    className={cn(
                                                        'px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                                                        isSelected
                                                            ? 'bg-[#224732] text-white'
                                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                    )}
                                                >
                                                    {emoji} {key}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 제출 버튼 */}
                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting || isUploading}
                            className="w-full bg-[#224732] hover:bg-[#1a3626] text-white h-12 text-base"
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            ) : (
                                <Send className="w-5 h-5 mr-2" />
                            )}
                            기록 남기기
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>

            {/* 이미지 편집 모달 */}
            {photoPreview && (
                <ImageEditorModal
                    isOpen={isEditorOpen}
                    onClose={() => setIsEditorOpen(false)}
                    imagePath={photoPreview}
                    onSave={handleEditedImageSave}
                />
            )}
        </>
    );
}
