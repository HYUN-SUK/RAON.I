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

import { DEFAULT_CAMPING_LOCATION } from '@/constants/location';
import { UtensilsCrossed } from 'lucide-react';

interface QuickRecordFormProps {
    isOpen: boolean;
    onClose: () => void;
    scheduleId?: string;
    initialScheduleDetail?: ScheduleInfo | null;
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

// 태그 키 -> 이모지 빠른 조회 맵
const TAG_EMOJI_MAP: Record<string, string> = Object.values(STANDARD_TAGS)
    .flat()
    .reduce((acc, cur) => {
        acc[cur.key] = cur.emoji;
        return acc;
    }, {} as Record<string, string>);

export default function QuickRecordForm({
    isOpen,
    onClose,
    scheduleId,
    initialScheduleDetail,
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
    const [showSuccess, setShowSuccess] = useState<boolean>(false); // Success view state
    const memoSectionRef = useRef<HTMLDivElement>(null);

    // [v14.1.2] 방금 작성한 캠핑장 고정 스냅샷 (부모의 다음 미작성 일정 변경으로 인한 덮어쓰기 원천 방어)
    const [submittedSnapshot, setSubmittedSnapshot] = useState<{
        recordId?: string;
        scheduleId?: string;
        name: string;
        address: string;
        lat?: number;
        lng?: number;
        photoUrl?: string | null;
        content: string;
        rating: number;
        tags: string[];
        isRaonai: boolean;
    } | null>(null);

    // New Fields
    const [name, setName] = useState('');

    const [address, setAddress] = useState('');

    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // New State for Map
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);

    // 일정 정보 로드 및 0.00초 즉시 자동완성
    useEffect(() => {
        if (!isOpen) {
            setScheduleInfo(null);
            setName('');
            setAddress('');
            setSelectedLocation(null);
            setShowSuccess(false);
            setRating(5);
            setSelectedTags([]);
            return;
        }

        let isCancelled = false;

        // 1. 부모로부터 전달받은 initialScheduleDetail이 있으면 네트워크 대기 없이 0.00초 즉시 세팅
        if (initialScheduleDetail && (!scheduleId || initialScheduleDetail.id === scheduleId)) {
            const baseName = initialScheduleDetail.campgroundName || initialScheduleDetail.title || '';
            const baseAddr = initialScheduleDetail.campgroundAddress || '';

            setScheduleInfo(initialScheduleDetail);
            setName(baseName);
            setAddress(baseAddr);

            if (initialScheduleDetail.latitude && initialScheduleDetail.longitude) {
                setSelectedLocation({
                    lat: initialScheduleDetail.latitude,
                    lng: initialScheduleDetail.longitude,
                });
            } else if (initialScheduleDetail.isRaonai || baseName.includes('라온아이')) {
                setSelectedLocation({
                    lat: DEFAULT_CAMPING_LOCATION.latitude,
                    lng: DEFAULT_CAMPING_LOCATION.longitude,
                });
            }

            if (initialScheduleDetail.isRaonai) {
                setIsPublic(true);
            }

            // 방문 횟수 및 누락 좌표는 백그라운드 비동기로 조용히 보완
            if (baseName) {
                getVisitCount(baseName).then((count) => {
                    if (!isCancelled && count > 0) {
                        setName(`${baseName} (${count + 1})`);
                    }
                }).catch(() => {});
            }

            if ((!initialScheduleDetail.latitude || !initialScheduleDetail.longitude) && scheduleId) {
                getScheduleForRecord(scheduleId).then((info) => {
                    if (!isCancelled && info?.latitude && info?.longitude) {
                        setSelectedLocation({ lat: info.latitude, lng: info.longitude });
                    }
                }).catch(() => {});
            }
            return () => {
                isCancelled = true;
            };
        }

        // 2. initialScheduleDetail 없이 scheduleId만 전달된 경우: 조회 직후 baseName 먼저 즉시 반영
        if (scheduleId) {
            getScheduleForRecord(scheduleId).then(async (info) => {
                if (isCancelled || !info) return;
                setScheduleInfo(info);

                const baseName = info.campgroundName || info.title || '';
                const baseAddr = info.campgroundAddress || '';

                // 방문 횟수 대기 전에 즉시 이름과 주소 먼저 세팅 (딜레이 제거)
                setName(baseName);
                setAddress(baseAddr);

                if (info.latitude && info.longitude) {
                    setSelectedLocation({ lat: info.latitude, lng: info.longitude });
                }

                if (info.isRaonai) {
                    setIsPublic(true);
                }

                if (baseName) {
                    const count = await getVisitCount(baseName);
                    if (!isCancelled && count > 0) {
                        setName(`${baseName} (${count + 1})`);
                    }
                }
            });
        }

        return () => {
            isCancelled = true;
        };
    }, [scheduleId, initialScheduleDetail, isOpen]);

    // 만족도 선택 핸들러
    const handleSatisfactionSelect = (val: number) => {
        setRating(val);
    };

    // 태그 토글 (텍스트 자동 문장 주입 없이 순수 태그 상태만 관리)
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
    };

    // 제출
    const handleSubmit = async () => {
        if (!content.trim() && !photoUrl && selectedTags.length === 0) {
            toast.error('내용, 사진, 또는 태그를 추가해주세요');
            return;
        }

        setIsSubmitting(true);
        try {
            const finalLat = selectedLocation?.lat || scheduleInfo?.latitude;
            const finalLng = selectedLocation?.lng || scheduleInfo?.longitude;
            const finalName = name || scheduleInfo?.title || '나의 캠핑 기록';
            const finalAddress = address || scheduleInfo?.campgroundAddress || '';

            const result = await createRecord({
                scheduleId,
                content: content.trim(),
                photoUrl: photoUrl || undefined,
                tags: selectedTags,
                isPublic,
                campgroundType: scheduleInfo?.isRaonai ? 'raonai' : 'external',
                campgroundName: finalName,
                campgroundAddress: finalAddress,
                latitude: finalLat,
                longitude: finalLng,
                rating: rating, // Add rating (satisfaction level)
            });

            if (result.success) {
                toast.success('기록이 저장되었어요! ✨');
                // 방금 작성한 일정의 스냅샷 고정 저장 (부모의 다음 미작성 일정 변경에 영향받지 않음)
                setSubmittedSnapshot({
                    recordId: result.id,
                    scheduleId,
                    name: finalName,
                    address: finalAddress,
                    lat: finalLat,
                    lng: finalLng,
                    photoUrl,
                    content: content.trim(),
                    rating,
                    tags: selectedTags,
                    isRaonai: !!scheduleInfo?.isRaonai
                });
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

    // 폼 리셋 및 닫기 (완전히 닫힐 때 부모의 onSuccess 실행)
    const handleClose = () => {
        setContent('');
        setPhotoUrl(null);
        setPhotoPreview(null);
        setSelectedTags([]);
        setIsPublic(false);
        setScheduleInfo(null);
        setIsMapOpen(false);
        setShowSuccess(false);
        setSubmittedSnapshot(null);
        setRating(5);
        onClose();
        onSuccess?.(); // 완료 화면이 완전히 닫힌 후 부모 데이터 갱신
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
                        <SheetTitle className="flex items-center gap-2 text-[#1E4D2B]">
                            <Sparkles className="w-5 h-5 text-[#388E5A]" />
                            10초 기록
                        </SheetTitle>
                    </SheetHeader>

                    {showSuccess ? (
                        /* 기록 완료 후 아카이브 락인(Lock-in) 루프 성공 화면 */
                        <div className="py-8 text-center space-y-5 animate-in fade-in duration-300">
                            <div className="w-16 h-16 bg-[#388E5A]/10 text-[#388E5A] rounded-full flex items-center justify-center mx-auto mb-2">
                                <Sparkles className="w-8 h-8 animate-bounce" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">기록 남기기 성공! ⛺</h3>
                                <p className="text-sm text-gray-500 leading-relaxed">
                                    <strong className="text-stone-800 font-bold">{submittedSnapshot?.name || '소중한 추억'}</strong>이 나만의 캠핑 지도에<br />
                                    별 모양 핀으로 예쁘게 꽂혔습니다.
                                </p>
                            </div>
                            <div className="pt-4 space-y-2.5 max-w-xs mx-auto">
                                {/* 버튼 1: 내 캠핑 지도에서 핀 확인하기 */}
                                <Button
                                    onClick={() => {
                                        const snap = submittedSnapshot;
                                        const targetSchedId = snap?.scheduleId || scheduleId;

                                        // 락인 액션: 10초 기록 연계 팝업용 스케줄 ID 보관
                                        if (targetSchedId) {
                                            useMySpaceStore.getState().setPendingVerificationScheduleId(targetSchedId);
                                        }

                                        // 좌표 결정 (방금 저장한 스냅샷 데이터 최우선 사용)
                                        let lat = snap?.lat;
                                        let lng = snap?.lng;
                                        const pinName = snap?.name || '나의 캠핑 기록';

                                        if (!lat || !lng) {
                                            if (snap?.isRaonai || pinName.includes('라온아이')) {
                                                lat = DEFAULT_CAMPING_LOCATION.latitude;
                                                lng = DEFAULT_CAMPING_LOCATION.longitude;
                                            }
                                        }

                                        // 0초 즉시 핀 주입 (실제 DB UUID를 바인딩하여 즉시 수정 및 DB 목록 중복 제거 완벽 보장)
                                        useMySpaceStore.getState().setOptimisticRecordPin({
                                            id: snap?.recordId ? `record-${snap.recordId}` : `record-opt-${Date.now()}`,
                                            siteName: pinName,
                                            x: 50,
                                            y: 50,
                                            lat: lat,
                                            lng: lng,
                                            visitedDate: new Date().toISOString(),
                                            isStamped: true,
                                            address: snap?.address || '캠핑장 위치',
                                            photos: snap?.photoUrl ? [snap.photoUrl] : [],
                                            memo: snap?.content || '',
                                            rating: snap?.rating || 5,
                                            isFavorite: false,
                                            tags: snap?.tags || []
                                        });

                                        if (lat && lng) {
                                            useMySpaceStore.getState().setTargetLocation({
                                                lat,
                                                lng,
                                                name: pinName
                                            });
                                        }

                                        useMySpaceStore.getState().setIsMapOpen(true);
                                        handleClose();
                                    }}
                                    className="w-full bg-[#388E5A] hover:bg-[#2F774B] text-white font-bold h-12 rounded-xl shadow-lg transition-transform active:scale-98"
                                >
                                    ⛺ 내 캠핑 지도에서 핀 확인하기
                                </Button>

                                {/* 버튼 2: 추천 맛집/명소 피드백 남기기 황금색 버튼 */}
                                {(submittedSnapshot?.scheduleId || scheduleId) && (
                                    <Button
                                        onClick={() => {
                                            const targetSchedId = submittedSnapshot?.scheduleId || scheduleId;
                                            useMySpaceStore.getState().setPendingVerificationScheduleId(null);
                                            handleClose();
                                            router.push(`/verify/${targetSchedId}`);
                                        }}
                                        className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-black h-12 rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-transform active:scale-98"
                                    >
                                        <UtensilsCrossed className="w-4 h-4" />
                                        <span>🌟 추천 맛집·명소 의견 남기기 (+100P)</span>
                                    </Button>
                                )}


                                {/* 버튼 3: 닫기 */}
                                <button
                                    onClick={handleClose}
                                    className="w-full text-xs font-semibold text-gray-400 hover:text-gray-600 py-1.5 transition-colors"
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
                                            className="bg-white h-8 text-xs font-semibold text-[#1E4D2B] cursor-pointer hover:bg-stone-50"
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

                            {/* 2. 공개 범위 선택 (카드 선택기 형태) */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">기록 공개 설정</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {/* 비공개 카드 */}
                                    <button
                                        type="button"
                                        onClick={() => setIsPublic(false)}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 transition-all active:scale-[0.98] text-left w-full h-[76px]",
                                            !isPublic
                                                ? "border-[#388E5A] bg-[#388E5A]/5 text-[#1E4D2B] font-bold"
                                                : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                                        )}
                                    >
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <Lock className={cn("w-4 h-4", !isPublic ? "text-[#388E5A]" : "text-stone-400")} />
                                            <span className="text-xs">나만 보기</span>
                                        </div>
                                        <p className="text-[9px] font-normal leading-tight text-stone-400 dark:text-stone-500 text-center">
                                            나만 아는 소중한 추억으로 간직할게요.
                                        </p>
                                    </button>

                                    {/* 공개 카드 */}
                                    <button
                                        type="button"
                                        onClick={() => setIsPublic(true)}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 transition-all active:scale-[0.98] text-left w-full h-[76px]",
                                            isPublic
                                                ? "border-[#388E5A] bg-[#388E5A]/5 text-[#1E4D2B] font-bold"
                                                : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                                        )}
                                    >
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <Globe className={cn("w-4 h-4", isPublic ? "text-[#388E5A]" : "text-stone-400")} />
                                            <span className="text-xs">전체 공개</span>
                                        </div>
                                        <p className="text-[9px] font-normal leading-tight text-stone-400 dark:text-stone-500 text-center">
                                            라온아이 캠퍼들과 이 감성을 나눌게요.
                                        </p>
                                    </button>
                                </div>
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
                                                        ? "bg-white shadow-sm border border-[#388E5A] scale-105" 
                                                        : "hover:bg-white/50 border border-transparent"
                                                )}
                                            >
                                                <span className="text-xl mb-0.5">{level.emoji}</span>
                                                <span className={cn("text-[9px] font-medium whitespace-nowrap scale-95 origin-center", isSelected ? "text-[#1E4D2B] font-bold" : "text-gray-400")}>
                                                    {level.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 4. 태그 선택 영역 (20개 전체 태그 한눈에 노출) */}
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-gray-700">태그 선택 (최대 5개)</span>
                                    <span className="text-xs font-bold text-[#388E5A] bg-[#EDF5EE] px-2 py-0.5 rounded-full">
                                        {selectedTags.length}/{MAX_TAGS}
                                    </span>
                                </div>

                                <div className="space-y-2.5 bg-stone-50/80 p-3 rounded-2xl border border-stone-200/80">
                                    {Object.entries(STANDARD_TAGS).map(([category, tags]) => (
                                        <div key={category} className="flex flex-col">
                                            <span className="text-[11px] font-bold text-stone-500 mb-1.5">{category}</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {tags.map(({ key, emoji }) => {
                                                    const isSelected = selectedTags.includes(key);
                                                    return (
                                                        <button
                                                            key={key}
                                                            type="button"
                                                            onClick={() => handleTagToggle(key)}
                                                            className={cn(
                                                                'px-2.5 py-1 rounded-full text-xs font-semibold transition-all active:scale-95',
                                                                isSelected
                                                                    ? 'bg-[#388E5A] text-white shadow-xs ring-1 ring-[#388E5A]'
                                                                    : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
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

                                {/* 하단 사진·기록 영역 스크롤 유도 힌트 배지 */}
                                <div className="flex justify-center pt-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            memoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300/80 text-[11px] font-extrabold text-[#1E4D2B] shadow-2xs active:scale-95 transition-all cursor-pointer animate-bounce"
                                    >
                                        <span>아래로 스크롤하여 사진 · 나의 기록 남기기</span>
                                        <span className="text-xs font-black">⌄</span>
                                    </button>
                                </div>
                            </div>

                            {/* 5. 사진 영역 (선택) */}
                            <div className="space-y-1.5">
                                <span className="text-xs font-semibold text-gray-600">사진 추가 (선택)</span>
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
                                                className="w-8 h-8 flex items-center justify-center bg-[#388E5A] rounded-full hover:bg-[#2F774B] transition-colors shadow-lg"
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
                                        className="w-full h-20 border border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 hover:border-[#388E5A] hover:bg-[#388E5A]/5 transition-colors"
                                    >
                                        <Camera className="w-5 h-5 text-gray-400" />
                                        <span className="text-xs text-gray-500">사진 추가하기</span>
                                    </button>
                                )}
                            </div>

                            {/* 6. 2단 분리형 메모 영역: [상단: 선택한 #태그 표기칸] + [하단: 사용자 직접 작성칸] */}
                            <div ref={memoSectionRef} className="space-y-1.5 scroll-mt-4">
                                <div className="rounded-2xl border-2 border-stone-200 bg-white overflow-hidden focus-within:border-[#388E5A] transition-colors shadow-2xs">
                                    {/* 상단 칸: 선택한 #태그 실시간 표기 영역 */}
                                    <div className="bg-[#F4F8F5] border-b border-stone-200/80 px-3.5 py-2.5 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-extrabold text-[#1E4D2B] flex items-center gap-1">
                                                <span>🏷️ 선택한 해시태그</span>
                                            </span>
                                            <span className="text-[10px] font-semibold text-stone-400">
                                                태그 터치 시 자동 반영
                                            </span>
                                        </div>
                                        {selectedTags.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                                                {selectedTags.map((tag) => (
                                                    <button
                                                        key={tag}
                                                        type="button"
                                                        onClick={() => handleTagToggle(tag)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#388E5A]/15 text-[#1E4D2B] border border-[#388E5A]/30 text-xs font-bold hover:bg-[#388E5A]/25 active:scale-95 transition-all"
                                                        title="터치하여 태그 해제"
                                                    >
                                                        <span>#{TAG_EMOJI_MAP[tag] ? `${TAG_EMOJI_MAP[tag]} ` : ''}{tag}</span>
                                                        <X className="w-3 h-3 text-[#2E7D47]" />
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-[11px] text-stone-400 font-medium py-0.5">
                                                위에서 태그를 터치하면 <strong className="text-[#388E5A] font-semibold">#뷰맛집</strong> 처럼 여기에 표시돼요.
                                            </p>
                                        )}
                                    </div>

                                    {/* 하단 칸: 순수 사용자 직접 글쓰기 영역 */}
                                    <div className="p-3 bg-white space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-extrabold text-stone-700 flex items-center gap-1">
                                                <span>✍️ 나의 캠핑 이야기 (직접 작성)</span>
                                            </span>
                                            <span className="text-[10px] font-semibold text-stone-400">
                                                {content.length}/{MAX_CONTENT_LENGTH}
                                            </span>
                                        </div>
                                        <Textarea
                                            value={content}
                                            onChange={(e) => {
                                                setContent(e.target.value.slice(0, MAX_CONTENT_LENGTH));
                                            }}
                                            placeholder="이번 캠핑에서 좋았던 순간이나 기억을 나만의 언어로 직접 적어보세요... (선택)"
                                            className="min-h-[84px] p-0 border-0 shadow-none resize-none focus-visible:ring-0 text-sm text-stone-800 placeholder:text-stone-400 leading-relaxed"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 제출 버튼 */}
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting || isUploading}
                                className="w-full bg-[#388E5A] hover:bg-[#2F774B] text-white h-11 text-base font-bold rounded-xl"
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
