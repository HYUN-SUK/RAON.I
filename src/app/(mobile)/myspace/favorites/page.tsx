'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Heart, Loader2, MapPin } from 'lucide-react';
import { getFavoriteCampgrounds, toggleFavorite } from '@/actions/schedule';
import { CampgroundWithScore } from '@/types/camping-ajiit';
import RecommendationCard from '@/components/planlock/RecommendationCard';
import { toast } from 'sonner';

export default function MyFavoritesPage() {
    const router = useRouter();
    const [favorites, setFavorites] = useState<CampgroundWithScore[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchFavorites = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getFavoriteCampgrounds();
            setFavorites(data);
        } catch (error) {
            console.error('Failed to fetch favorites:', error);
            toast.error('찜 목록을 불러오는데 실패했어요');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFavorites();
    }, [fetchFavorites]);

    const handleFavoriteToggle = async (id: string) => {
        // Optimistic update
        setFavorites(prev => prev.filter(c => c.id !== id));

        try {
            const result = await toggleFavorite(id);
            if (!result.success) {
                // Revert if failed (would need to re-fetch or keep state)
                toast.error('찜 취소에 실패했어요');
                fetchFavorites();
            } else {
                toast.success('찜 목록에서 삭제되었어요');
            }
        } catch (error) {
            toast.error('오류가 발생했어요');
            fetchFavorites();
        }
    };

    return (
        <div className="min-h-screen bg-[#F0EBE0] pb-20 font-serif relative">
            <div className="fixed inset-0 pointer-events-none opacity-30 mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]"></div>

            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#F0EBE0]/90 backdrop-blur-md px-4 h-14 flex items-center gap-3 border-b border-stone-300">
                <button
                    onClick={() => router.back()}
                    className="p-2 -ml-2 text-stone-700 hover:bg-stone-200/50 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="font-bold text-lg text-[#2C2C2C] font-serif tracking-tight flex items-center gap-2">
                    <Heart className="w-5 h-5 text-brand-1 fill-current" />
                    내가 찜한 캠핑장
                </h1>
            </header>

            <main className="px-5 pt-6 space-y-4 relative z-10">
                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
                    </div>
                ) : favorites.length > 0 ? (
                    <div className="space-y-4">
                        {favorites.map((camp, index) => (
                            <RecommendationCard
                                key={camp.id}
                                campground={camp}
                                rank={index + 1}
                                onFavoriteToggle={handleFavoriteToggle}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 border-2 border-dashed border-stone-200 rounded-xl m-2">
                        <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-2">
                            <Heart className="w-8 h-8 text-stone-300" />
                        </div>
                        <p className="font-medium text-stone-600">아직 찜한 캠핑장이 없어요</p>
                        <p className="text-sm text-stone-400">
                            마음에 드는 캠핑장을 발견하면<br />
                            하트 버튼을 눌러 저장해보세요!
                        </p>
                        <button
                            onClick={() => router.push('/')}
                            className="mt-4 px-6 py-2 bg-brand-1 text-white rounded-full text-sm font-medium hover:bg-brand-2 transition-colors"
                        >
                            캠핑장 둘러보기
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
