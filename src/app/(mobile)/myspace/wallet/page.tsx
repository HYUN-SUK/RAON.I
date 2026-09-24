"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMySpaceStore } from '@/store/useMySpaceStore';
import { getLevelInfo } from '@/config/pointPolicy'; // Helper if needed
import { pointService } from '@/services/pointService';
import { createClient } from '@/lib/supabase-client';
import { PointStatusCard } from '@/components/profile/PointStatusCard';
import { ArrowLeft, History, TrendingUp, TrendingDown, Calendar, CheckCircle2, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

type FilterType = 'ALL' | 'EARNED' | 'USED';

interface VerifiedPlaceItem {
    id: string;
    place_id: string;
    place_name: string;
    stage?: string;
    liked?: boolean;
    fact_status?: string;
    review_state?: string;
    verified_at?: string;
}

const supabase = createClient();

export default function WalletPage() {
    const router = useRouter();
    // Correct store usage
    const { xp, level, raonToken, setWallet } = useMySpaceStore();

    // Construct local wallet object for Card
    const wallet = { xp, level, raonToken, goldPoint: 0, point: raonToken };

    const [filter, setFilter] = useState<FilterType>('ALL');

    const [history, setHistory] = useState<any[]>([]);
    const [contributions, setContributions] = useState<VerifiedPlaceItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // [v12.1.0] 스크롤 부담 완화를 위한 5개 기본 노출 및 5개씩 점진적 더보기 상태
    const [visibleHistoryCount, setVisibleHistoryCount] = useState(5);
    const [visibleContributionsCount, setVisibleContributionsCount] = useState(5);

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

                // 3. Load Verified Places (2-step query, PGRST200 방어)
                try {
                    const { data: verifs, error: verifError } = await supabase
                        .from('place_verifications')
                        .select('*')
                        .eq('user_id', user.id)
                        .order('verified_at', { ascending: false });

                    if (!verifError && verifs && verifs.length > 0) {
                        const placeIds = Array.from(new Set(verifs.map(v => v.place_id).filter(Boolean)));
                        const nameMap = new Map<string, string>();
                        if (placeIds.length > 0) {
                            const { data: places } = await supabase
                                .from('master_places')
                                .select('id, name')
                                .in('id', placeIds);
                            if (places) {
                                places.forEach(p => nameMap.set(p.id, p.name));
                            }
                        }

                        const items: VerifiedPlaceItem[] = verifs.map(d => ({
                            id: d.id,
                            place_id: d.place_id,
                            place_name: nameMap.get(d.place_id) || '라온아이 추천 장소',
                            stage: d.stage,
                            liked: d.liked,
                            fact_status: d.fact_status,
                            review_state: d.review_state,
                            verified_at: d.verified_at ? d.verified_at.split('T')[0] : '',
                        }));
                        setContributions(items);
                    }
                } catch (err) {
                    console.error('Failed to load place verifications:', err);
                }
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

    // [v12.1.0] 활동 내역 5개씩 점진적 노출
    const displayedHistory = React.useMemo(() => {
        return filteredHistory.slice(0, visibleHistoryCount);
    }, [filteredHistory, visibleHistoryCount]);

    // [v12.1.0] 확인 내역 5개씩 점진적 노출
    const displayedContributions = React.useMemo(() => {
        return contributions.slice(0, visibleContributionsCount);
    }, [contributions, visibleContributionsCount]);

    return (
        <div className="min-h-screen bg-[#F8FAF8] dark:bg-black pb-20">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#F8FAF8]/80 dark:bg-black/80 backdrop-blur-md px-4 h-14 flex items-center gap-3">
                <button
                    onClick={() => router.back()}
                    className="p-2 -ml-2 text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-zinc-800 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="font-bold text-lg text-[#1E4D2B] dark:text-[#388E5A]">나의 탐험 지수</h1>
            </header>

            <div className="bg-[#E9EFEA] border-b border-[#388E5A]/20 px-5 py-3">
                <p className="text-xs text-[#2D5A3C] leading-relaxed">
                    💡 탐험지수인 경험치, 라온토큰은 현금성이 아닌 라온아이 어플안에서 재미, 경험 확장을 위한 수단입니다.
                </p>
            </div>

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
                                onClick={() => {
                                    setFilter(tab);
                                    setVisibleHistoryCount(5);
                                }}
                                className={cn(
                                    "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
                                    filter === tab
                                        ? "bg-white dark:bg-zinc-600 text-[#1E4D2B] dark:text-white shadow-sm"
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
                        <>
                            <div className="space-y-3">
                                {displayedHistory.map((item) => (
                                    <div
                                        key={item.id}
                                        className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-stone-100 dark:border-zinc-800 flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                 "w-10 h-10 rounded-full flex items-center justify-center text-lg",
                                                 item.amount > 0 ? "bg-[#E9EFEA] text-[#388E5A]" : "bg-orange-50 text-orange-600"
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
                                            item.amount > 0 ? "text-[#388E5A] dark:text-[#388E5A]" : "text-stone-500"
                                        )}>
                                            {item.amount > 0 ? '+' : ''}{item.amount.toLocaleString()} T
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* 활동 내역 5개 초과 시 점진적 더보기(+5개씩) 및 접기 */}
                            {filteredHistory.length > 5 && (
                                <div className="flex gap-2 mt-3">
                                    {visibleHistoryCount < filteredHistory.length ? (
                                        <button
                                            onClick={() => setVisibleHistoryCount(prev => prev + 5)}
                                            className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold text-stone-600 dark:text-stone-300 bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800 transition-all shadow-xs active:scale-[0.99]"
                                        >
                                            <span>활동 내역 5개 더보기 (남은 {filteredHistory.length - visibleHistoryCount}개)</span>
                                            <ChevronDown size={15} />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setVisibleHistoryCount(5)}
                                            className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-zinc-800/80 border border-stone-200/80 dark:border-zinc-800 rounded-xl hover:bg-stone-200/70 transition-all shadow-xs active:scale-[0.99]"
                                        >
                                            <span>활동 내역 접기 (처음 5개만 보기)</span>
                                            <ChevronUp size={15} />
                                        </button>
                                    )}
                                    {visibleHistoryCount > 5 && visibleHistoryCount < filteredHistory.length && (
                                        <button
                                            onClick={() => setVisibleHistoryCount(5)}
                                            className="px-3.5 py-2.5 flex items-center justify-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-700 bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-xl transition-all shadow-xs active:scale-[0.99]"
                                            title="처음 5개로 접기"
                                        >
                                            <span>접기</span>
                                            <ChevronUp size={14} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="py-12 text-center text-stone-400 bg-white dark:bg-zinc-900 rounded-2xl border border-stone-100 border-dashed">
                            <History className="w-8 h-8 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">내역이 없습니다.</p>
                        </div>
                    )}
                </div>

                {/* 3. 내가 확인한 장소 Section */}
                <div className="mt-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-[#388E5A]" />
                            내가 확인한 장소
                            {contributions.length > 0 && (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E9EFEA] text-[#1E4D2B]">
                                    {contributions.length}곳
                                </span>
                            )}
                        </h2>
                    </div>

                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2].map(i => (
                                <div key={i} className="h-16 bg-white dark:bg-zinc-900 rounded-2xl animate-pulse" />
                            ))}
                        </div>
                    ) : contributions.length > 0 ? (
                        <>
                            <div className="space-y-3">
                                {displayedContributions.map((item) => (
                                    <div
                                        key={item.id}
                                        className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-stone-100 dark:border-zinc-800 flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-[#E9EFEA] text-[#388E5A] flex items-center justify-center text-lg">
                                                <CheckCircle2 size={18} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-stone-800 dark:text-stone-200">
                                                    {item.place_name}
                                                </p>
                                                <p className="text-xs text-stone-400 flex items-center gap-1 mt-0.5">
                                                    <Calendar size={10} />
                                                    {item.verified_at || '방문 확인 완료'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#E9EFEA] text-[#1E4D2B]">
                                                정보확인 완료
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* 확인 내역 5개 초과 시 점진적 더보기(+5개씩) 및 접기 */}
                            {contributions.length > 5 && (
                                <div className="flex gap-2 mt-3">
                                    {visibleContributionsCount < contributions.length ? (
                                        <button
                                            onClick={() => setVisibleContributionsCount(prev => prev + 5)}
                                            className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold text-[#1E4D2B] dark:text-[#388E5A] bg-[#E9EFEA]/70 dark:bg-zinc-900 border border-[#388E5A]/20 dark:border-zinc-800 rounded-xl hover:bg-[#E9EFEA] transition-all shadow-xs active:scale-[0.99]"
                                        >
                                            <span>확인한 장소 5개 더보기 (남은 {contributions.length - visibleContributionsCount}곳)</span>
                                            <ChevronDown size={15} />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setVisibleContributionsCount(5)}
                                            className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-zinc-800/80 border border-stone-200/80 dark:border-zinc-800 rounded-xl hover:bg-stone-200/70 transition-all shadow-xs active:scale-[0.99]"
                                        >
                                            <span>확인 내역 접기 (처음 5곳만 보기)</span>
                                            <ChevronUp size={15} />
                                        </button>
                                    )}
                                    {visibleContributionsCount > 5 && visibleContributionsCount < contributions.length && (
                                        <button
                                            onClick={() => setVisibleContributionsCount(5)}
                                            className="px-3.5 py-2.5 flex items-center justify-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-700 bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-xl transition-all shadow-xs active:scale-[0.99]"
                                            title="처음 5곳으로 접기"
                                        >
                                            <span>접기</span>
                                            <ChevronUp size={14} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="py-10 text-center text-stone-400 bg-white dark:bg-zinc-900 rounded-2xl border border-stone-100 border-dashed">
                            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">아직 확인한 장소가 없습니다.</p>
                            <p className="text-xs text-stone-400 mt-1">캠핑장 주변 장소를 방문하고 확인 내역을 남겨보세요!</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
