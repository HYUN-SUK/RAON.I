"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMySpaceStore, AlbumItem } from '@/store/useMySpaceStore';
import PhotoGrid from '@/components/myspace/PhotoGrid';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import UnlockableFeatureSection from '@/components/myspace/UnlockableFeatureSection';
import { cn } from '@/lib/utils';

const FILTERS = ["전체", "텐트", "불멍", "요리", "풍경"];

export default function MySpaceAlbumPage() {
    const router = useRouter();
    const { album, fetchAlbum } = useMySpaceStore();
    const [activeFilter, setActiveFilter] = useState("전체");

    useEffect(() => {
        // Load data
        if (album.length === 0) {
            fetchAlbum();
        }
    }, [fetchAlbum, album.length]);

    const filteredPhotos = React.useMemo(() => {
        if (activeFilter === "전체") return album;
        // Simple mock filter: check if any tag string contains the filter keyword
        return album.filter(item =>
            item.tags?.some(tag => tag.includes(activeFilter))
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
                    <PhotoGrid photos={filteredPhotos} />
                </div>

                {filteredPhotos.length === 0 && (
                    <div className="py-20 text-center text-stone-400">
                        <p>해당하는 사진이 없어요.</p>
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
