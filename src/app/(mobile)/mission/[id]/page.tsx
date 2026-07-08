'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useMissionStore } from '@/store/useMissionStore';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import TopBar from '@/components/TopBar';
import { ArrowLeft, Camera, CheckCircle, UploadCloud, Trash2, Heart, RefreshCw } from 'lucide-react';
import { EmberButton } from '@/components/mission/EmberButton';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

import { toast } from "sonner";
import { createClient } from '@/lib/supabase-client';
import { dispatchPersonaAction } from '@/lib/persona';
import { missionService } from '@/services/missionService';
import { HEALING_PHRASES } from '@/constants/healingPhrases';
import { compressImage } from '@/utils/imageCompressor';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export default function MissionDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { currentMission, userMission, participants, fetchCurrentMission, joinMission, completeMission, toggleLike, deleteParticipation, isLoading, error } = useMissionStore();
    const [preview, setPreview] = useState<string | null>(null);

    const [isMounted, setIsMounted] = useState(false);
    const [healingPhrase, setHealingPhrase] = useState('');
    const [completedCount, setCompletedCount] = useState<number>(0);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Initial Load
    useEffect(() => {
        fetchCurrentMission();
    }, [fetchCurrentMission]);

    // Fetch Completed Users Count
    useEffect(() => {
        if (currentMission) {
            missionService.getCompletedUsersCount(currentMission.id)
                .then(count => setCompletedCount(count));
        }
    }, [currentMission]);

    // Handle Healing Phrase Initialization
    useEffect(() => {
        if (userMission?.content) {
            setHealingPhrase(userMission.content);
        } else {
            const randomIndex = Math.floor(Math.random() * HEALING_PHRASES.length);
            setHealingPhrase(HEALING_PHRASES[randomIndex]);
        }
    }, [userMission]);

    // Error Feedback
    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    // State for file
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // Editor State
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [tempImage, setTempImage] = useState<string | null>(null);

    // Dynamic Import
    const ImageEditorModal = dynamic(() => import('@/components/record/ImageEditorModal'), { ssr: false });

    // State for Deletion Dialog
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedParticipationIdForDelete, setSelectedParticipationIdForDelete] = useState<string | null>(null);

    const handleDeleteClick = (participationId?: string) => {
        // If specific ID logic is needed later, we can use it. 
        // For now, deleteParticipation deletes the CURRENT user's participation.
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        setIsDeleteDialogOpen(false);
        await deleteParticipation();
        if (currentMission) {
            const count = await missionService.getCompletedUsersCount(currentMission.id);
            setCompletedCount(count);
        }
    };

    const handleRefreshPhrase = () => {
        const randomIndex = Math.floor(Math.random() * HEALING_PHRASES.length);
        setHealingPhrase(HEALING_PHRASES[randomIndex]);
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Check size (allow up to 20MB in UI, compressor will shrink it)
            if (file.size > 20 * 1024 * 1024) {
                toast.error("이미지 크기는 20MB 이하여야 합니다.");
                return;
            }

            const url = URL.createObjectURL(file);
            setTempImage(url);
            setIsEditorOpen(true);

            // Clear input so same file can be selected again
            e.target.value = '';
        }
    };

    const handleEditorSave = async (dataUrl: string) => {
        setPreview(dataUrl);

        // Convert Data URL to File for upload
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], "mission_proof.png", { type: "image/png" });
        setSelectedFile(file);

        setIsEditorOpen(false);
        setTempImage(null);
    };

    const handleJoin = async () => {
        await joinMission();

        // --- [Phase 2] Tag Sensor: Mission Start ---
        if (currentMission) {
            await dispatchPersonaAction(userMission?.user_id || '', 'MISSION_PARTICIPATE' as any);
            
            if (currentMission.title?.includes('LNT') || currentMission.title?.includes('환경')) {
                await dispatchPersonaAction(userMission?.user_id || '', 'MISSION_LNT_START' as any);
            }
        }
    };

    const handleComplete = async () => {
        if (isLoading) return;
        if (!selectedFile) {
            toast.error("인증 사진을 선택해주세요.");
            return;
        }

        try {
            // Compress Image first
            toast.info("이미지를 최적화하는 중입니다...");
            const compressedFile = await compressImage(selectedFile);

            // Upload Image first
            // We use communityService as it has the upload helper
            const imageUrl = await import('@/services/communityService').then(m => m.communityService.uploadImage(compressedFile));

            await completeMission(healingPhrase || "미션 인증 완료! 📸", imageUrl);
            toast.success("미션 인증 성공! 보상이 지급되었습니다.");

            // Update completed count
            if (currentMission) {
                const count = await missionService.getCompletedUsersCount(currentMission.id);
                setCompletedCount(count);
            }
        } catch (e) {
            console.error(e);
            const message = e instanceof Error ? e.message : "알 수 없는 오류";
            toast.error("업로드 실패: " + message);
        }
    };

    if (!isMounted || (isLoading && !currentMission)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F7F5EF] dark:bg-black">
                <p className="text-stone-500">미션을 불러오는 중...</p>
            </div>
        );
    }

    if (!currentMission) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F5EF] dark:bg-black gap-4">
                <p className="text-stone-500">진행 중인 미션이 없습니다.</p>
                <Button onClick={() => router.back()}>돌아가기</Button>
            </div>
        );
    }

    const endDate = new Date(currentMission.end_date);
    const isJoined = !!userMission;
    const isCompleted = userMission?.status === 'COMPLETED' || userMission?.status === 'CLAIMED';

    return (
        <div className="min-h-screen bg-[#F7F5EF] dark:bg-black pb-24">
            <header className="sticky top-0 z-50 bg-[#F7F5EF]/80 dark:bg-black/80 backdrop-blur-md border-b border-black/5 px-4 h-14 flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="font-bold text-lg">이번 주 미션</h1>
            </header>

            <main className="p-5">
                <div className="flex flex-col gap-1 mb-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-[#1C4526] hover:bg-[#1C4526] text-white">Weekly</Badge>
                        <span className="text-xs text-stone-500" suppressHydrationWarning>
                            ~ {format(endDate, 'M월 d일', { locale: ko })}까지
                        </span>
                    </div>
                    <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100">
                        {currentMission.title}
                    </h1>
                    <p className="text-stone-600 dark:text-stone-300 mt-2 leading-relaxed">
                        {currentMission.description}
                    </p>
                </div>

                {/* Rewards */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 mb-8 border border-stone-100 dark:border-zinc-800 shadow-sm">
                    <h3 className="font-bold text-sm text-stone-700 dark:text-stone-200 mb-3">미션 달성 보상</h3>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2 bg-[#F7F5EF] dark:bg-zinc-800 px-3 py-2 rounded-lg">
                            <span className="text-lg">✨</span>
                            <div>
                                <p className="text-[10px] text-stone-500">경험치</p>
                                <p className="font-bold text-sm">{currentMission.reward_xp} XP</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 bg-[#F7F5EF] dark:bg-zinc-800 px-3 py-2 rounded-lg">
                            <span className="text-lg">🪙</span>
                            <div>
                                <p className="text-[10px] text-stone-500">라온토큰</p>
                                <p className="font-bold text-sm text-orange-600">{currentMission.reward_point} 개</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Participation Status */}
                {isCompleted ? (
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-stone-100 dark:border-zinc-800 shadow-md p-5 text-center">
                        <h3 className="font-bold text-xs text-stone-400 mb-3 uppercase tracking-wider text-left">내가 기록한 오늘의 찰나</h3>
                        {userMission?.image_url && (
                            <div className="aspect-video bg-stone-100 rounded-xl overflow-hidden mb-4 relative shadow-sm">
                                <img src={userMission.image_url} alt="My Mission Proof" className="w-full h-full object-cover" />
                                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[10px] flex items-center gap-1 font-semibold">
                                    <CheckCircle className="w-3 h-3 text-[#C3A675]" /> 인증 완료
                                </div>
                            </div>
                        )}
                        <p className="text-stone-700 dark:text-stone-200 font-medium text-base leading-relaxed italic px-2">
                            "{userMission?.content || '기록된 소감이 없습니다.'}"
                        </p>
                        <div className="mt-6 pt-4 border-t border-stone-100 dark:border-zinc-800 flex items-center justify-between text-xs text-stone-400">
                            <span suppressHydrationWarning>
                                {userMission?.completed_at ? format(new Date(userMission.completed_at), 'yyyy년 M월 d일 HH:mm', { locale: ko }) : ''}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-stone-400 hover:text-red-500 hover:bg-red-50/50 text-xs h-8"
                                onClick={() => handleDeleteClick()}
                            >
                                <Trash2 className="w-3.5 h-3.5 mr-1" />
                                기록 삭제
                            </Button>
                        </div>
                    </div>
                ) : !isJoined ? (
                    <Button
                        className="w-full h-14 text-lg font-bold bg-[#1C4526] hover:bg-[#224732] text-white rounded-xl shadow-lg shadow-[#1C4526]/20 transition-all hover:scale-[1.02]"
                        onClick={handleJoin}
                    >
                        미션 도전하기
                    </Button>
                ) : (
                    <div className="space-y-4">
                        <div className="bg-[#1C4526]/10 p-4 rounded-xl flex items-start gap-3 border border-[#1C4526]/20">
                            <span className="text-2xl">🔥</span>
                            <div>
                                <h4 className="font-bold text-[#1C4526] dark:text-[#3E614B] text-sm">미션 진행 중!</h4>
                                <p className="text-xs text-[#1C4526] dark:text-[#3E614B] mt-1">
                                    오늘의 소감 한 줄과 함께 사진을 올려주세요.
                                </p>
                            </div>
                        </div>

                        {/* 소감 입력창 및 랜덤 새로고침 */}
                        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-stone-100 dark:border-zinc-800 shadow-sm">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold text-stone-500">오늘의 힐링 한 줄 소감</label>
                                <button
                                    onClick={handleRefreshPhrase}
                                    className="text-[10px] text-[#1C4526] hover:text-[#224732] font-semibold flex items-center gap-1 active:scale-95 transition-transform"
                                >
                                    <RefreshCw className="w-3 h-3" /> 다른 문구 추천받기
                                </button>
                            </div>
                            <textarea
                                className="w-full min-h-[70px] p-3 bg-[#F7F5EF] dark:bg-zinc-800 text-stone-800 dark:text-stone-100 rounded-lg text-sm border-none focus:ring-1 focus:ring-[#1C4526] resize-none outline-none leading-relaxed"
                                placeholder="오늘의 느낌을 적어보세요..."
                                value={healingPhrase}
                                onChange={(e) => setHealingPhrase(e.target.value)}
                                maxLength={150}
                            />
                            <div className="text-right text-[10px] text-stone-400 mt-1">
                                {healingPhrase.length}/150
                            </div>
                        </div>

                        <div className="border-2 border-dashed border-stone-300 dark:border-zinc-700 rounded-xl min-h-[240px] flex flex-col items-center justify-center relative overflow-hidden bg-white dark:bg-zinc-900 transition-colors hover:bg-stone-50 dark:hover:bg-zinc-800/50">
                            {preview ? (
                                <>
                                    <img src={preview} alt="Mission Proof" className="absolute inset-0 w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                        <label htmlFor="mission-upload" className="cursor-pointer px-4 py-2 bg-white/90 rounded-lg text-sm font-bold shadow-sm hover:bg-white">
                                            사진 변경하기
                                        </label>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center p-6 w-full h-full flex flex-col items-center justify-center">
                                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Camera className="w-8 h-8 text-blue-500" />
                                    </div>
                                    <p className="text-stone-800 dark:text-stone-200 font-semibold mb-1">인증 사진 올리기</p>
                                    <p className="text-xs text-stone-500 mb-6">미션 수행을 증명할 수 있는 사진을 찍어주세요</p>

                                    <label htmlFor="mission-upload" className="cursor-pointer w-full max-w-xs">
                                        <div className="w-full py-3 bg-white border border-stone-200 dark:border-zinc-700 rounded-xl text-sm font-semibold shadow-sm hover:bg-stone-50 transition-colors text-center">
                                            갤러리에서 선택
                                        </div>
                                        <input
                                            id="mission-upload"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleImageSelect}
                                        />
                                    </label>
                                </div>
                            )}
                        </div>

                        <Button
                            className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            disabled={!preview || isLoading}
                            onClick={handleComplete}
                        >
                            {isLoading ? '업로드 중...' : '인증 제출하고 완료하기'}
                        </Button>
                    </div>
                )}

                {/* Anonymous completed camper counter */}
                <div className="mt-8 mb-6 bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-stone-100 dark:border-zinc-800 text-center shadow-sm">
                    <div className="w-12 h-12 bg-[#F7F5EF] dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">
                        🌌
                    </div>
                    <h3 className="font-bold text-stone-800 dark:text-stone-100 text-base mb-1.5">오늘 이 미션을 함께한 캠퍼들</h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed max-w-[280px] mx-auto">
                        오늘 이 미션을 완료한 캠퍼가 벌써 <span className="text-[#1C4526] dark:text-[#3E614B] font-bold text-sm">{completedCount}명</span>이에요. 각자의 아늑한 공간에서 따뜻하게 같은 계절의 찰나를 수집하고 있습니다.
                    </p>
                </div>
            </main>

            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>미션 참여 기록 삭제</DialogTitle>
                        <DialogDescription>
                            정말 삭제하시겠습니까? 인증 사진과 작성된 댓글, 받은 보상이 모두 회수됩니다.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>취소</Button>
                        <Button variant="destructive" onClick={confirmDelete}>삭제하기</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Image Editor Modal */}
            {
                tempImage && isEditorOpen && (
                    <ImageEditorModal
                        isOpen={isEditorOpen}
                        onClose={() => setIsEditorOpen(false)}
                        imagePath={tempImage}
                        onSave={handleEditorSave}
                    />
                )
            }
        </div >
    );
}
