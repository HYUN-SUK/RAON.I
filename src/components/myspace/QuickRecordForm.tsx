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
import { useMySpaceStore } from '@/store/useMySpaceStore';
import { compressImage } from '@/utils/imageCompressor';
import { useRouter } from 'next/navigation';

// 동적 import (SSR 비활성화)
const ImageEditorModal = dynamic(
    () => import('@/components/record/ImageEditorModal'),
    { ssr: false }
);

const MyMapModal = dynamic(
    () => import('./MyMapModal'),
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

// 감성 만족도 이모지 프리셋
const SATISFACTION_LEVELS = [
    { value: 5, label: '최고의 힐링', emoji: '🌟' },
    { value: 4, label: '편안한 하루', emoji: '💚' },
    { value: 3, label: '잔잔한 쉼', emoji: '⛺' },
    { value: 2, label: '조금 아쉬운 순간', emoji: '🌦️' },
    { value: 1, label: '속상한 기억', emoji: '☔' },
];

// 로컬 룰 기반 AI 감성 초안 템플릿
const CAPTION_TEMPLATES = [
    "{campgroundName}에서 {emoji} {satisfaction} 시간을 보내며 {tags}의 소중한 추억을 따뜻하게 아카이빙합니다.",
    "{campgroundName}에서의 캠핑은 {emoji} {satisfaction} 그 자체였습니다. {tags}의 추억을 마음속에 깊이 남깁니다.",
    "{emoji} {satisfaction} 가득했던 {campgroundName}에서의 하루. {tags} 덕분에 더 특별한 쉼이 되었습니다.",
    "고요한 자연 속 {campgroundName}에서 느낀 {emoji} {satisfaction}. {tags}의 조각들을 하나씩 기록해 둡니다.",
    "{emoji} {satisfaction} 기억을 남겨준 {campgroundName}. {tags}의 감성을 가득 안고 돌아갑니다."
];

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

// 룰 기반 자동 캡션 생성기
function generateAutoCaption(satisfactionVal: number, tagsVal: string[], campName: string): string {
    if (!campName) return '';
    const satisfactionObj = SATISFACTION_LEVELS.find(s => s.value === satisfactionVal) || SATISFACTION_LEVELS[0];
    const emoji = satisfactionObj.emoji;
    const satisfaction = satisfactionObj.label;
    const tagsStr = tagsVal.length > 0 ? tagsVal.map(t => `#${t}`).join(' ') : '#행복한캠핑';
    
    // 무작위 템플릿 선택
    const randIdx = Math.floor(Math.random() * CAPTION_TEMPLATES.length);
    const template = CAPTION_TEMPLATES[randIdx];
    
    return template
        .replace(/{campgroundName}/g, campName)
        .replace(/{emoji}/g, emoji)
        .replace(/{satisfaction}/g, satisfaction)
        .replace(/{tags}/g, tagsStr);
}

export default function QuickRecordForm({
    isOpen,
    onClose,
    scheduleId,
    onSuccess
}: QuickRecordFormProps) {
    const router = useRouter();
    const [content, setContent] = useState('');
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [isPublic, setIsPublic] = useState(false);
    const [scheduleInfo, setScheduleInfo] = useState<ScheduleInfo | null>(null);
    const [rating, setRating] = useState<number>(5); // Default: 최고의 힐링
    const [lastGenerated, setLastGenerated] = useState<string>(''); // Auto-caption tracking
    const [showSuccess, setShowSuccess] = useState<boolean>(false); // Success view state

    // New Fields
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');

    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // New State for Map
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);

    // 일정 정보 로드 및 자동완성
    useEffect(() => {
        if (scheduleId && isOpen) {
            getScheduleForRecord(scheduleId).then(async info => {
                setScheduleInfo(info);

                if (info) {
                    const baseName = info.campgroundName || info.title;
                    const baseAddr = info.campgroundAddress || '';

                    setAddress(baseAddr);

                    // 좌표 설정
                    if (info.latitude && info.longitude) {
                        setSelectedLocation({ lat: info.latitude, lng: info.longitude });
                    }

                    // 방문 횟수 체크 (동일 이름)
                    let resolvedName = baseName;
                    if (baseName) {
                        const count = await getVisitCount(baseName);
                        if (count > 0) {
                            resolvedName = `${baseName} (${count + 1})`;
                        }
                    }
                    setName(resolvedName || '');

                    // 라온아이 캠핑장이면 기본 공개
                    if (info.isRaonai) {
                        setIsPublic(true);
                    }

                    // 초기 자동 캡션 적용
                    const initialCaption = generateAutoCaption(5, [], resolvedName || '');
                    setContent(initialCaption);
                    setLastGenerated(initialCaption);
                }
            });
        } else {
            setScheduleInfo(null);
            setName('');
            setAddress('');
            setSelectedLocation(null);
            setShowSuccess(false);
            setRating(5);
            setSelectedTags([]);
        }
    }, [scheduleId, isOpen]);

    // 캡션 자동 업데이트 트리거
    const triggerAutoCaption = (satisfactionVal: number, tagsVal: string[], campName: string) => {
        if (content.trim() === '' || content === lastGenerated) {
            const newCaption = generateAutoCaption(satisfactionVal, tagsVal, campName);
            setContent(newCaption);
            setLastGenerated(newCaption);
        }
    };

    // 만족도 선택 핸들러
    const handleSatisfactionSelect = (val: number) => {
        setRating(val);
        triggerAutoCaption(val, selectedTags, name);
    };

    // 태그 토글
    const handleTagToggle = (tag: string) => {
        setSelectedTags(prev => {
            let nextTags = [];
            if (prev.includes(tag)) {
                nextTags = prev.filter(t => t !== tag);
            } else {
                if (prev.length >= MAX_TAGS) {
                    toast.error(`태그는 최대 ${MAX_TAGS}개까지 선택할 수 있어요`);
                    return prev;
                }
                nextTags = [...prev, tag];
            }
            triggerAutoCaption(rating, nextTags, name);
            return nextTags;
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
            const compressedFile = await compressImage(file);
            const result = await uploadRecordImage(compressedFile);
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
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], `edited-${Date.now()}.png`, { type: 'image/png' });

        setIsUploading(true);
        try {
            const compressedFile = await compressImage(file);
            const result = await uploadRecordImage(compressedFile);
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

    // 장소 선택 핸들러
    const handlePlaceSelect = (place: { name: string; address: string; lat: number; lng: number }) => {
        setName(place.name);
        setAddress(place.address);
        setSelectedLocation({ lat: place.lat, lng: place.lng });
        setIsMapOpen(false);
        triggerAutoCaption(rating, selectedTags, place.name);
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
                campgroundName: name,
                campgroundAddress: address,
                latitude: selectedLocation?.lat || scheduleInfo?.latitude,
                longitude: selectedLocation?.lng || scheduleInfo?.longitude,
                rating: rating, // Add rating (satisfaction level)
            });

            if (result.success) {
                toast.success('기록이 저장되었어요! ✨');
                onSuccess?.();
                setShowSuccess(true); // Switch to success view instead of closing directly
            } else {
                toast.error(result.error || '저장 실패');
            }
        } catch {
            toast.error('오류가 발생했어요');
        } finally {
            setIsSubmitting(false);
        }
    };

    // 폼 리셋 및 닫기
    const handleClose = () => {
        setContent('');
        setPhotoUrl(null);
        setPhotoPreview(null);
        setSelectedTags([]);
        setIsPublic(false);
        setScheduleInfo(null);
        setIsMapOpen(false);
        setShowSuccess(false);
        setRating(5);
        onClose();
    };

    return (
        <>
            <Sheet open={isOpen} onOpenChange={handleClose}>
                <SheetContent
                    side="bottom"
                    className="rounded-t-3xl max-h-[85vh] overflow-y-auto"
                    onInteractOutside={(e) => {
                        if (isEditorOpen || isMapOpen) {
                            e.preventDefault();
                        }
                    }}
                    onPointerDownOutside={(e) => {
                        if (isEditorOpen || isMapOpen) {
                            e.preventDefault();
                        }
                    }}
                >
                    <SheetHeader className="pb-3 border-b border-gray-100">
                        <SheetTitle className="flex items-center gap-2 text-[#224732]">
                            <Sparkles className="w-5 h-5" />
                            10초 기록
                        </SheetTitle>
                    </SheetHeader>

                    {showSuccess ? (
                        /* 기록 완료 후 아카이브 락인(Lock-in) 루프 성공 화면 */
                        <div className="py-8 text-center space-y-5 animate-in fade-in duration-300">
                            <div className="w-16 h-16 bg-[#224732]/10 text-[#224732] rounded-full flex items-center justify-center mx-auto mb-2">
                                <Sparkles className="w-8 h-8 animate-bounce" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">기록 남기기 성공! ⛺</h3>
                                <p className="text-sm text-gray-500 leading-relaxed">
                                    다녀오신 소중한 추억이 나만의 캠핑 지도에<br />
                                    별 모양 핀으로 예쁘게 꽂혔습니다.
                                </p>
                            </div>
                            <div className="pt-4 space-y-2.5 max-w-xs mx-auto">
                                <Button
                                    onClick={() => {
                                        // 락인 액션: 전역 지도 모달 오픈
                                        const lat = selectedLocation?.lat || scheduleInfo?.latitude;
                                        const lng = selectedLocation?.lng || scheduleInfo?.longitude;
                                        if (lat && lng) {
                                            useMySpaceStore.getState().setTargetLocation({
                                                lat,
                                                lng,
                                                name: name || '캠핑 기록'
                                            });
                                        }
                                        useMySpaceStore.getState().setIsMapOpen(true);
                                        
                                        // 무조건 내 수첩(지도가 있는 곳)으로 라우팅 이동
                                        router.push('/myspace');
                                        
                                        handleClose();
                                    }}
                                    className="w-full bg-[#224732] hover:bg-[#1a3626] text-white font-bold h-12 rounded-xl shadow-lg"
                                >
                                    내 캠핑 지도에서 핀 확인하기
                                </Button>
                                <button
                                    onClick={handleClose}
                                    className="w-full text-sm font-medium text-gray-400 hover:text-gray-600 py-2"
                                >
                                    닫기
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* 10초 콤팩트 작성 폼 (이모지 & 태그 최상단 배치) */
                        <div className="py-4 space-y-4">
                            {/* 1. 일정 정보 표시 */}
                            <div className="space-y-3 bg-stone-50 p-3 rounded-xl border border-stone-100">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] font-semibold text-stone-500 mb-0.5 block flex items-center gap-1">
                                            <MapPin className="w-2.5 h-2.5" /> 캠핑장
                                        </label>
                                        <Input
                                            value={name}
                                            placeholder="캠핑장 검색"
                                            className="bg-white h-8 text-xs font-semibold text-[#224732] cursor-pointer hover:bg-stone-50"
                                            readOnly
                                            onClick={() => setIsMapOpen(true)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-semibold text-stone-500 mb-0.5 block flex items-center gap-1">
                                            <MapPin className="w-2.5 h-2.5" /> 주소
                                        </label>
                                        <Input
                                            value={address}
                                            placeholder="주소 정보"
                                            className="bg-white h-8 text-[11px] text-stone-600 truncate cursor-pointer hover:bg-stone-50"
                                            readOnly
                                            onClick={() => setIsMapOpen(true)}
                                        />
                                    </div>
                                </div>

                                {scheduleInfo && (
                                    <div className="flex items-center gap-2 text-[10px] text-stone-400 pt-0.5">
                                        <Calendar className="w-2.5 h-2.5" />
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

                            {/* 2. 공개/비공개 토글 */}
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

                            {/* 3. 감성 만족도 이모지 선택기 (NEW: 상단 배치) */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">오늘의 캠핑은 어땠나요?</label>
                                <div className="flex justify-between items-center gap-1 bg-stone-50 p-2 rounded-xl border border-stone-100">
                                    {SATISFACTION_LEVELS.map((level) => {
                                        const isSelected = rating === level.value;
                                        return (
                                            <button
                                                key={level.value}
                                                type="button"
                                                onClick={() => handleSatisfactionSelect(level.value)}
                                                className={cn(
                                                    "flex flex-col items-center justify-center flex-1 py-2 px-1 rounded-lg transition-all active:scale-95",
                                                    isSelected 
                                                        ? "bg-white shadow-sm border border-[#224732] scale-105" 
                                                        : "hover:bg-white/50 border border-transparent"
                                                )}
                                            >
                                                <span className="text-xl mb-0.5">{level.emoji}</span>
                                                <span className={cn("text-[9px] font-medium whitespace-nowrap scale-95 origin-center", isSelected ? "text-[#224732] font-bold" : "text-gray-400")}>
                                                    {level.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 4. 태그 선택 영역 (NEW: 상단 배치) */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700">태그 선택</span>
                                    <span className="text-xs text-gray-400">{selectedTags.length}/{MAX_TAGS}</span>
                                </div>

                                <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                                    {Object.entries(STANDARD_TAGS).map(([category, tags]) => (
                                        <div key={category} className="flex flex-col">
                                            <span className="text-[10px] text-gray-400 mb-1">{category}</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {tags.map(({ key, emoji }) => {
                                                    const isSelected = selectedTags.includes(key);
                                                    return (
                                                        <button
                                                            key={key}
                                                            type="button"
                                                            onClick={() => handleTagToggle(key)}
                                                            className={cn(
                                                                'px-2 py-0.5 rounded-full text-xs font-medium transition-all scale-95 origin-left',
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
                            </div>

                            {/* 5. 사진 영역 (NEW: 하단 배치) */}
                            <div className="space-y-1">
                                <span className="text-xs font-semibold text-gray-400">사진 추가 (선택)</span>
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
                                            className="w-full h-36 object-cover rounded-xl"
                                        />
                                        {isUploading && (
                                            <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                                                <Loader2 className="w-8 h-8 text-white animate-spin" />
                                            </div>
                                        )}
                                        <div className="absolute top-2 right-2 flex gap-2 z-10">
                                            <button
                                                type="button"
                                                onClick={() => setIsEditorOpen(true)}
                                                className="w-8 h-8 flex items-center justify-center bg-[#224732] rounded-full hover:bg-[#1a3626] transition-colors shadow-lg"
                                                disabled={isUploading}
                                                aria-label="사진 편집"
                                            >
                                                <Edit3 className="w-3.5 h-3.5 text-white" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleRemovePhoto}
                                                className="w-8 h-8 flex items-center justify-center bg-black/70 rounded-full hover:bg-black/90 transition-colors shadow-lg"
                                                disabled={isUploading}
                                                aria-label="사진 삭제"
                                            >
                                                <X className="w-3.5 h-3.5 text-white" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full h-20 border border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 hover:border-[#224732] hover:bg-[#224732]/5 transition-colors"
                                    >
                                        <Camera className="w-5 h-5 text-gray-400" />
                                        <span className="text-xs text-gray-500">사진 추가하기</span>
                                    </button>
                                )}
                            </div>

                            {/* 6. 메모 영역 (NEW: 하단 배치 & AI 감성 초안 자동 주입) */}
                            <div className="space-y-1">
                                <span className="text-xs font-semibold text-gray-400">캠핑 메모 (선택)</span>
                                <Textarea
                                    value={content}
                                    onChange={(e) => {
                                        setContent(e.target.value.slice(0, MAX_CONTENT_LENGTH));
                                    }}
                                    placeholder="캠핑 경험을 자유롭게 적어주세요..."
                                    className="min-h-[80px] resize-none border-gray-200 focus:border-[#224732] focus:ring-[#224732] text-sm leading-relaxed"
                                />
                                <div className="text-right text-[10px] text-gray-400">
                                    {content.length}/{MAX_CONTENT_LENGTH}
                                </div>
                            </div>

                            {/* 제출 버튼 */}
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting || isUploading}
                                className="w-full bg-[#224732] hover:bg-[#1a3626] text-white h-11 text-base font-bold rounded-xl"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                ) : (
                                    <Send className="w-5 h-5 mr-2" />
                                )}
                                기록 남기기
                            </Button>
                        </div>
                    )}
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

            {/* 지도 선택 모달 */}
            <MyMapModal
                isOpen={isMapOpen}
                onClose={() => setIsMapOpen(false)}
                mode="schedule"
                autoSearch={true}
                onPlaceSelect={handlePlaceSelect}
            />
        </>
    );
}
