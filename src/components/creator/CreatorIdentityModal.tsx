'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal'; // Assuming custom Modal
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Check, X, Loader2 } from 'lucide-react';
import { creatorService } from '@/services/creatorService';
// import { toast } from 'sonner'; // Removed due to missing module

interface CreatorIdentityModalProps {
    isOpen: boolean;
    onClose: () => void; // Usually just to close, but maybe force setup?
    onComplete: () => void;
    currentUserId: string;
    initialNickname?: string | null;
    initialImage?: string | null;
}

export function CreatorIdentityModal({
    isOpen,
    onClose,
    onComplete,
    currentUserId,
    initialNickname,
    initialImage
}: CreatorIdentityModalProps) {
    const [nickname, setNickname] = useState(initialNickname || '');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(initialImage || null);

    // Validation States
    const [isChecking, setIsChecking] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [validationMsg, setValidationMsg] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Debounce Check
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (nickname.trim().length < 2) {
                setIsAvailable(null);
                setValidationMsg('');
                return;
            }

            // If nickname hasn't changed from initial and it exists, it's valid (my own)
            if (initialNickname && nickname === initialNickname) {
                setIsAvailable(true);
                setValidationMsg('현재 사용 중인 활동명입니다.');
                return;
            }

            setIsChecking(true);
            try {
                const available = await creatorService.checkNicknameAvailability(nickname);
                setIsAvailable(available);
                setValidationMsg(available ? '사용 가능한 활동명입니다.' : '이미 사용 중인 활동명입니다.');
            } catch (error) {
                console.error(error);
                setValidationMsg('확인 중 오류가 발생했습니다.');
            } finally {
                setIsChecking(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [nickname, initialNickname]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert('이미지 크기는 5MB 이하여야 합니다.');
                return;
            }
            setImageFile(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        }
    };

    const handleSubmit = async () => {
        if (!isAvailable && nickname !== initialNickname) return;
        if (nickname.trim().length < 2) {
            alert('활동명은 2글자 이상이어야 합니다.');
            return;
        }

        setIsSubmitting(true);
        try {
            let imageUrl = initialImage;

            if (imageFile) {
                imageUrl = await creatorService.uploadImage(imageFile, 'creator-profiles'); // New bucket? Or stick to creator-assets
            }

            await creatorService.upsertCreatorProfile({
                id: currentUserId,
                nickname: nickname,
                profile_image_url: imageUrl
            });

            alert('자아 설정이 완료되었습니다! 크리에이터 활동을 시작해보세요.');
            onComplete();
            // onClose(); // Handled by onComplete usually or parent
        } catch (error) {
            console.error(error);
            alert('설정 저장에 실패했습니다. (DB 오류일 수 있습니다)');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => { /* Prevent closing if mandatory? For now allow close */ onClose(); }}
            title="크리에이터 활동명 설정"
            className="sm:max-w-[400px]"
        >
            <div className="flex flex-col items-center space-y-6 pt-4 pb-2">
                <div className="relative group cursor-pointer w-24 h-24">
                    <Avatar className="w-24 h-24 border-2 border-gray-100">
                        <AvatarImage src={previewUrl || ''} />
                        <AvatarFallback className="bg-gray-100">
                            <span className="text-2xl text-gray-400">?</span>
                        </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="text-white w-8 h-8" />
                    </div>
                    <Input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleImageChange}
                    />
                </div>
                <div className="text-center space-y-1">
                    <h4 className="font-semibold text-gray-900">프로필 사진</h4>
                    <p className="text-xs text-gray-500">나를 표현하는 이미지를 등록하세요.</p>
                </div>

                <div className="w-full space-y-2">
                    <Label htmlFor="nickname">활동명 (Nickname)</Label>
                    <div className="relative">
                        <Input
                            id="nickname"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            placeholder="예: 밤하늘의별, 캠핑장인"
                            className="pr-10"
                            maxLength={20}
                        />
                        <div className="absolute right-3 top-2.5">
                            {isChecking ? (
                                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                            ) : isAvailable === true ? (
                                <Check className="w-4 h-4 text-green-500" />
                            ) : isAvailable === false ? (
                                <X className="w-4 h-4 text-red-500" />
                            ) : null}
                        </div>
                    </div>
                    {validationMsg && (
                        <p className={`text-xs ${isAvailable ? 'text-green-600' : 'text-red-500'}`}>
                            {validationMsg}
                        </p>
                    )}
                </div>

                <div className="bg-gray-50 p-3 rounded-lg w-full text-xs text-gray-600 space-y-1">
                    <p className="font-medium text-gray-800">💡 알아두세요</p>
                    <ul className="list-disc pl-4 space-y-1">
                        <li>이후 모든 콘텐츠에 예약자명(실명) 대신 <strong>활동명</strong>이 표시됩니다.</li>
                        <li>언제든지 마이 페이지에서 변경할 수 있습니다.</li>
                        <li>부적절한 활동명은 운영자에 의해 변경될 수 있습니다.</li>
                    </ul>
                </div>

                <Button
                    className="w-full bg-[#224732] hover:bg-[#1C3A29] text-white"
                    onClick={handleSubmit}
                    disabled={isSubmitting || (isAvailable === false && nickname !== initialNickname) || nickname.length < 2 || isChecking}
                >
                    {isSubmitting ? '저장 중...' : '설정 완료하고 시작하기'}
                </Button>
            </div>
        </Modal>
    );
}
