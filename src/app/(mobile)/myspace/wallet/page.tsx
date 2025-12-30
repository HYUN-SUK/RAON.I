"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMySpaceStore } from '@/store/useMySpaceStore';
import { getLevelInfo } from '@/config/pointPolicy'; // Helper if needed
import { pointService } from '@/services/pointService';
import { createClient } from '@/lib/supabase-client';
import { PointStatusCard } from '@/components/profile/PointStatusCard';
import { ArrowLeft, History, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

type FilterType = 'ALL' | 'EARNED' | 'USED';

const supabase = createClient();

export default function WalletPage() {
    const router = useRouter();
    // Correct store usage
    const { xp, level, raonToken, setWallet } = useMySpaceStore();

    // Construct local wallet object for Card
    const wallet = { xp, level, raonToken, goldPoint: 0, point: raonToken };

    const [filter, setFilter] = useState<FilterType>('ALL');

    const [history, setHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadWalletAndHistory = async () => {
            setIsLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // 1. Sync Wallet
                const fetchedWallet = await pointService.getWallet(user.id);
                if (fetchedWallet) {
                    setWallet(fetchedWallet.xp, fetchedWallet.level, fetchedWallet.raonToken);
                }

                // 2. Load History
                const hist = await pointService.getHistory(user.id);
                setHistory(hist);
            }
            setIsLoading(false);
        };
        loadWalletAndHistory();
    }, [setWallet]);

    const filteredHistory = React.useMemo(() => {
        if (!history) return [];
        return history.filter(item => {
            if (filter === 'ALL') return true;
            if (filter === 'EARNED') return item.amount > 0;
            if (filter === 'USED') return item.amount < 0;
            return true;
        });
    }, [history, filter]);

    return (
        <div className="min-h-screen bg-[#F7F5EF] dark:bg-black pb-20">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#F7F5EF]/80 dark:bg-black/80 backdrop-blur-md px-4 h-14 flex items-center gap-3">
                <button
                    onClick={() => router.back()}
                    className="p-2 -ml-2 text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-zinc-800 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="font-bold text-lg text-[#1C4526] dark:text-green-400">나의 탐험 지수</h1>
            </header>

            <main className="px-5 pt-2">
                {/* 1. Status Card (Detail View) */}
                <div className="mb-8">
                    <PointStatusCard wallet={wallet} loading={isLoading} variant="detail" />
                </div>

                {/* 2. History Section */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
                            <History className="w-5 h-5 opacity-70" />
                            활동 내역
                        </h2>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex p-1 bg-stone-200 dark:bg-zinc-800 rounded-xl mb-6">
                        {(['ALL', 'EARNED', 'USED'] as FilterType[]).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setFilter(tab)}
                                className={cn(
                                    "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
                                    filter === tab
                                        ? "bg-white dark:bg-zinc-600 text-[#1C4526] dark:text-white shadow-sm"
                                        : "text-stone-500 dark:text-stone-400 hover:text-stone-700"
                                )}
                            >
                                {tab === 'ALL' ? '전체' : tab === 'EARNED' ? '획득' : '사용'}
                            </button>
                        ))}
                    </div>

                    {/* List */}
                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-16 bg-white dark:bg-zinc-900 rounded-2xl animate-pulse" />
                            ))}
                        </div>
                    ) : filteredHistory.length > 0 ? (
                        <div className="space-y-3">
                            {filteredHistory.map((item) => (
                                <div
                                    key={item.id}
                                    className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-stone-100 dark:border-zinc-800 flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-10 h-10 rounded-full flex items-center justify-center text-lg",
                                            item.amount > 0 ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-600"
                                        )}>
                                            {item.amount > 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-stone-800 dark:text-stone-200">
                                                {item.reason === 'MISSION_REWARD' ? '미션 완료 보상' :
                                                    item.reason === 'USAGE' ? '아이템 사용' : item.reason}
                                            </p>
                                            <p className="text-xs text-stone-400 flex items-center gap-1 mt-0.5">
                                                <Calendar size={10} />
                                                {format(new Date(item.created_at), 'yyyy.MM.dd HH:mm', { locale: ko })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={cn(
                                        "text-sm font-bold font-mono",
                                        item.amount > 0 ? "text-[#1C4526] dark:text-green-400" : "text-stone-500"
                                    )}>
                                        {item.amount > 0 ? '+' : ''}{item.amount.toLocaleString()} T
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 text-center text-stone-400 bg-white dark:bg-zinc-900 rounded-2xl border border-stone-100 border-dashed">
                            <History className="w-8 h-8 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">내역이 없습니다.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
