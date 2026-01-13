"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMySpaceStore, AlbumItem } from '@/store/useMySpaceStore';
import PhotoGrid from '@/components/myspace/PhotoGrid';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import UnlockableFeatureSection from '@/components/myspace/UnlockableFeatureSection';
import { cn } from '@/lib/utils';

const FILTERS = ["전체", "#게시글", "#미션"];

export default function MySpaceAlbumPage() {
    const router = useRouter();
    const { album, fetchAlbum } = useMySpaceStore();
    const [activeFilter, setActiveFilter] = useState("전체");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // 매번 마운트 시 최신 사진 가져오기
        const loadAlbum = async () => {
            setIsLoading(true);
            await fetchAlbum();
            setIsLoading(false);
        };
        loadAlbum();
    }, [fetchAlbum]);

    const filteredPhotos = React.useMemo(() => {
        if (activeFilter === "전체") return album;
        // 태그 기반 필터링
        return album.filter(item =>
            item.tags?.some(tag => tag.includes(activeFilter.replace('#', '')))
        );
    }, [album, activeFilter]);

    return (
        <div className="min-h-screen bg-[#F7F5EF] dark:bg-black pb-24">
            {/* Top Bar */}
            <header className="sticky top-0 z-50 bg-[#F7F5EF]/80 dark:bg-black/80 backdrop-blur-md border-b border-black/5 dark:border-white/10 px-4 h-14 flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="font-bold text-lg">내 앨범</h1>
                <div className="ml-auto">
                    <Button variant="ghost" size="icon">
                        <ImageIcon className="w-5 h-5 text-stone-500" />
                    </Button>
                </div>
            </header>

            <main>
                {/* Filters */}
                <div className="px-4 py-4 overflow-x-auto scrollbar-hide">
                    <div className="flex gap-2">
                        {FILTERS.map(filter => (
                            <Button
                                key={filter}
                                variant={activeFilter === filter ? "default" : "outline"}
                                onClick={() => setActiveFilter(filter)}
                                className={cn(
                                    "rounded-full h-8 text-xs font-medium px-4",
                                    activeFilter === filter
                                        ? "bg-[#1C4526] hover:bg-[#15341d] text-white"
                                        : "bg-white border-stone-200 text-stone-600"
                                )}
                            >
                                {filter}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Grid */}
                <div className="mt-2 text-stone-300">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-stone-400 mb-2" />
                            <p className="text-stone-400 text-sm">사진을 불러오는 중...</p>
                        </div>
                    ) : (
                        <PhotoGrid photos={filteredPhotos} />
                    )}
                </div>

                {!isLoading && filteredPhotos.length === 0 && (
                    <div className="py-20 text-center text-stone-400">
                        <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="mb-2">아직 앨범에 사진이 없어요.</p>
                        <p className="text-sm">게시글이나 미션 인증에서 사진을 업로드하면<br />이곳에 자동으로 모아집니다!</p>
                        <Button
                            variant="outline"
                            className="mt-4 text-[#1C4526] border-[#1C4526]"
                            onClick={() => router.push('/community/write?type=STORY')}
                        >
                            첫 기록 남기기
                        </Button>
                    </div>
                )}

                {/* Unlockable Features */}
                <div className="px-4 pb-8 border-t border-stone-200 mt-8 pt-4">
                    <UnlockableFeatureSection />
                </div>
            </main>
        </div>
    );
}
