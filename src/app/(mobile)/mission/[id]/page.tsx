'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useMissionStore } from '@/store/useMissionStore';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import TopBar from '@/components/TopBar';
import { ArrowLeft, Camera, CheckCircle, UploadCloud, Trash2, Heart } from 'lucide-react';
import { EmberButton } from '@/components/mission/EmberButton';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

import { toast } from "sonner";
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

    // Initial Load
    useEffect(() => {
        fetchCurrentMission();
    }, [fetchCurrentMission]);

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
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Check size
            if (file.size > 5 * 1024 * 1024) {
                toast.error("이미지 크기는 5MB 이하여야 합니다.");
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
    };

    const handleComplete = async () => {
        if (!selectedFile) {
            toast.error("인증 사진을 선택해주세요.");
            return;
        }

        try {
            // Upload Image first
            // We use communityService as it has the upload helper
            const imageUrl = await import('@/services/communityService').then(m => m.communityService.uploadImage(selectedFile));

            await completeMission("미션 인증 완료! 📸", imageUrl);
            toast.success("미션 인증 성공! 보상이 지급되었습니다.");
        } catch (e) {
            console.error(e);
            const message = e instanceof Error ? e.message : "알 수 없는 오류";
            toast.error("업로드 실패: " + message);
        }
    };

    if (isLoading && !currentMission) {
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
                {/* Hero Section */}
                <div className="relative w-full aspect-video bg-stone-200 rounded-2xl overflow-hidden mb-6 shadow-sm">
                    {/* Placeholder for Mission Hero Image */}
                    <div className="absolute inset-0 flex items-center justify-center bg-stone-100 text-stone-400">
                        <Camera className="w-12 h-12 opacity-20" />
                    </div>
                </div>

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
                    <div className="bg-stone-100 dark:bg-zinc-800 rounded-xl p-6 text-center border border-stone-200 dark:border-zinc-700">
                        <div className="w-16 h-16 bg-stone-200 dark:bg-zinc-700 rounded-full flex items-center justify-center mx-auto mb-3">
                            <CheckCircle className="w-8 h-8 text-stone-400 dark:text-stone-500" />
                        </div>
                        <h3 className="font-bold text-stone-500 dark:text-stone-400 text-lg mb-1">미션 완료</h3>
                        <p className="text-sm text-stone-400 dark:text-stone-500">이미 보상을 받았습니다.</p>
                        <Button
                            variant="ghost"
                            className="mt-4 text-xs text-stone-400 hover:text-red-500"
                            onClick={() => handleDeleteClick()}
                        >
                            <Trash2 className="w-3 h-3 mr-1" />
                            참여 기록 삭제
                        </Button>
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
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl flex items-start gap-3 border border-blue-100 dark:border-blue-900/30">
                            <span className="text-2xl">🔥</span>
                            <div>
                                <h4 className="font-bold text-blue-900 dark:text-blue-100 text-sm">미션 진행 중!</h4>
                                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                    인증샷을 업로드하고 보상을 받아가세요.
                                </p>
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

                {/* Participants Feed */}
                <div className="mt-10 mb-6">
                    <h3 className="font-bold text-lg text-stone-800 dark:text-stone-100 mb-4 flex items-center justify-between">
                        참여 인증 <span className="text-[#1C4526] text-sm font-normal">{participants.length}명 참여중</span>
                    </h3>

                    <div className="space-y-4">
                        {!participants || participants.length === 0 ? (
                            <div className="text-center py-8 text-stone-400 bg-stone-50 rounded-xl">
                                <UploadCloud className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">가장 먼저 미션을 달성해보세요!</p>
                            </div>
                        ) : (
                            participants.map((p) => (
                                <div key={p.id} className="bg-white dark:bg-zinc-900 rounded-xl overflow-hidden border border-stone-100 dark:border-zinc-800 shadow-sm">
                                    <div className="p-3 flex items-center gap-2 border-b border-stone-50 dark:border-zinc-800">
                                        <div className="w-8 h-8 rounded-full bg-stone-200 overflow-hidden">
                                            {p.user_info?.profile_image_url ? (
                                                <img src={p.user_info.profile_image_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-stone-400">
                                                    {p.user_info?.nickname?.substring(0, 1) || '?'}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-stone-700 dark:text-stone-200">
                                                {p.user_info?.nickname || '알 수 없음'}
                                            </p>
                                            <p className="text-[10px] text-stone-400">
                                                {format(new Date(p.created_at), 'M월 d일 HH:mm', { locale: ko })}
                                            </p>
                                        </div>
                                    </div>

                                    {p.image_url && (
                                        <div className="aspect-square bg-stone-100">
                                            <img src={p.image_url} alt="Mission Proof" className="w-full h-full object-cover" />
                                        </div>
                                    )}

                                    {p.content && (
                                        <div className="p-3 pb-0">
                                            <p className="text-sm text-stone-600 dark:text-stone-300">{p.content}</p>
                                        </div>
                                    )}

                                    <div className="p-3 flex items-center justify-between">
                                        {/* Ember Button (for other users' posts only) */}
                                        {userMission?.user_id !== p.user_id && (
                                            <EmberButton
                                                receiverId={p.user_id}
                                                targetId={p.id}
                                                targetType="mission"
                                                receiverName={p.user_info?.nickname || '이 캠퍼'}
                                            />
                                        )}

                                        {/* Like count display */}
                                        <div className="flex items-center gap-1 text-stone-400 text-sm">
                                            <Heart className="w-4 h-4" />
                                            <span>{p.likes_count || 0}</span>
                                        </div>

                                        {/* Delete button (own posts only) */}
                                        <div className="flex items-center gap-2">
                                            {userMission?.user_id === p.user_id && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-stone-400 hover:text-red-500 hover:bg-red-50"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteClick();
                                                    }}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                        {/* Like Button Removed as per request (SSOT: Comment Likes) */}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
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
