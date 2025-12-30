'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMissionStore } from '@/store/useMissionStore';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TopBar from '@/components/TopBar';
import { Flag, ChevronRight, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function MissionListPage() {
    const router = useRouter();
    const { missions, fetchMissions, isLoading } = useMissionStore();

    useEffect(() => {
        fetchMissions();
    }, [fetchMissions]);

    if (isLoading && missions.length === 0) {
        return (
            <div className="min-h-screen bg-[#F7F5EF] dark:bg-black">
                <TopBar />
                <div className="flex justify-center items-center h-[calc(100vh-64px)]">
                    <p className="text-stone-500">미션을 불러오는 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F7F5EF] dark:bg-black pb-24">
            <TopBar />

            <main className="px-4 py-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-2">
                        이번 주 미션에<br />도전해보세요! 🚀
                    </h1>
                    <p className="text-stone-500 text-sm">
                        미션을 달성하고 경험치와 포인트를 획득하세요.
                    </p>
                </div>

                {missions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-10 bg-white dark:bg-zinc-900 rounded-2xl border border-stone-100 dark:border-zinc-800">
                        <Flag className="w-12 h-12 text-stone-300 mb-4" />
                        <p className="text-stone-500">현재 진행 중인 미션이 없습니다.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {missions.map((mission) => {
                            const isExpired = new Date(mission.end_date) < new Date();
                            return (
                                <Card
                                    key={mission.id}
                                    className="border-none shadow-md overflow-hidden relative"
                                    onClick={() => router.push(`/mission/${mission.id}`)}
                                >
                                    {/* Card Content Bg */}
                                    <div className={`p-5 ${isExpired ? 'bg-stone-100 dark:bg-zinc-800' : 'bg-white dark:bg-zinc-900'}`}>
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2">
                                                <Badge variant={isExpired ? "secondary" : "default"} className={isExpired ? "" : "bg-[#1C4526]"}>
                                                    {isExpired ? '마감됨' : '진행중'}
                                                </Badge>
                                                <span className="text-xs text-stone-400 flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    ~ {format(new Date(mission.end_date), 'M월 d일', { locale: ko })}
                                                </span>
                                            </div>
                                        </div>

                                        <h3 className={`font-bold text-lg mb-1.5 ${isExpired ? 'text-stone-400' : 'text-stone-800 dark:text-stone-100'}`}>
                                            {mission.title}
                                        </h3>
                                        <p className="text-stone-500 text-sm line-clamp-2 mb-4">
                                            {mission.description}
                                        </p>

                                        <div className="flex items-center justify-between mt-auto">
                                            <div className="flex gap-2">
                                                <span className="text-xs font-semibold text-[#C3A675] bg-[#C3A675]/10 px-2 py-1 rounded-md">
                                                    {mission.reward_xp} XP
                                                </span>
                                                <span className="text-xs font-semibold text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-md">
                                                    {mission.reward_point} 토큰
                                                </span>
                                            </div>
                                            <Button variant="ghost" size="sm" className="h-8 pr-0 hover:bg-transparent hover:text-[#1C4526]">
                                                자세히보기 <ChevronRight className="w-4 h-4 ml-1" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
