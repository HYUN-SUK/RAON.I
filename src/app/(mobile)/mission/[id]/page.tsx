'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMissionStore } from '@/store/useMissionStore';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import TopBar from '@/components/TopBar';
import { ArrowLeft, Camera, CheckCircle, UploadCloud } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

import { toast } from "sonner";

export default function MissionDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { currentMission, userMission, fetchCurrentMission, joinMission, completeMission, isLoading, error } = useMissionStore();
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

    // Handle Image Selection (Mock)
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleJoin = async () => {
        await joinMission();
    };

    const handleComplete = async () => {
        // In real world, we would upload the image to storage here
        await completeMission("Photo Verification URL");
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
                            <span className="text-lg">💰</span>
                            <div>
                                <p className="text-[10px] text-stone-500">포인트</p>
                                <p className="font-bold text-sm">{currentMission.reward_point} P</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Participation Status */}
                {isCompleted ? (
                    <div className="bg-[#1C4526]/10 rounded-xl p-6 text-center border border-[#1C4526]/20">
                        <div className="w-16 h-16 bg-[#1C4526] rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-[#1C4526]/20">
                            <CheckCircle className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="font-bold text-[#1C4526] text-lg mb-1">미션 성공!</h3>
                        <p className="text-sm text-stone-600">보상이 지급되었습니다.</p>
                    </div>
                ) : !isJoined ? (
                    <Button
                        className="w-full h-14 text-lg font-bold bg-[#1C4526] hover:bg-[#224732] text-white rounded-xl shadow-lg shadow-[#1C4526]/20"
                        onClick={handleJoin}
                    >
                        미션 도전하기
                    </Button>
                ) : (
                    <div className="space-y-4">
                        <div className="border-2 border-dashed border-stone-300 dark:border-zinc-700 rounded-xl min-h-[200px] flex flex-col items-center justify-center relative overflow-hidden bg-stone-50 dark:bg-zinc-900">
                            {preview ? (
                                <img src={preview} alt="Mission Proof" className="absolute inset-0 w-full h-full object-cover" />
                            ) : (
                                <div className="text-center p-6">
                                    <div className="w-12 h-12 bg-stone-200 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Camera className="w-6 h-6 text-stone-500" />
                                    </div>
                                    <p className="text-sm text-stone-500 mb-4">인증샷을 올려주세요</p>
                                    <label htmlFor="mission-upload" className="cursor-pointer">
                                        <div className="px-4 py-2 bg-white border border-stone-300 rounded-lg text-sm font-semibold shadow-sm hover:bg-stone-50">
                                            사진 선택하기
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
                            className="w-full h-14 text-lg font-bold bg-[#1C4526] hover:bg-[#224732] text-white rounded-xl shadow-lg shadow-[#1C4526]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!preview || isLoading}
                            onClick={handleComplete}
                        >
                            {isLoading ? '업로드 중...' : '인증하고 보상받기'}
                        </Button>
                    </div>
                )}
            </main>
        </div>
    );
}
