"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMySpaceStore, TimelineItem } from '@/store/useMySpaceStore';
import TimelineCard from '@/components/myspace/TimelineCard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, Search, ChevronDown } from 'lucide-react';
import RecordTools from '@/components/myspace/RecordTools';
import { cn } from '@/lib/utils';

export default function MySpaceHistoryPage() {
    const router = useRouter();
    const { timelineItems, fetchTimeline } = useMySpaceStore();

    // State for Search and Pagination
    const [searchTerm, setSearchTerm] = useState('');
    const [visibleCount, setVisibleCount] = useState(10); // Initial load: 10 items

    useEffect(() => {
        // Load data on mount
        fetchTimeline();
    }, [fetchTimeline]);

    // Filter items based on search term
    const filteredItems = useMemo(() => {
        if (!searchTerm.trim()) return timelineItems;
        const lowerTerm = searchTerm.toLowerCase();
        return timelineItems.filter(item =>
            item.title.toLowerCase().includes(lowerTerm) ||
            (item.content && item.content.toLowerCase().includes(lowerTerm))
        );
    }, [timelineItems, searchTerm]);

    // Slice items for pagination
    const displayedItems = useMemo(() => {
        // Sort by date DESC before slicing
        const sorted = [...filteredItems].sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        return sorted.slice(0, visibleCount);
    }, [filteredItems, visibleCount]);

    // Group items by Year-Month
    const groupedItems = useMemo(() => {
        const groups: Record<string, TimelineItem[]> = {};

        displayedItems.forEach(item => {
            const date = new Date(item.date);
            const key = `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        return groups;
    }, [displayedItems]);

    const handleLoadMore = () => {
        setVisibleCount(prev => prev + 10);
    };

    const hasMore = visibleCount < filteredItems.length;

    return (
        <div className="min-h-screen bg-[#F7F5EF] dark:bg-black pb-24">
            {/* Top Bar */}
            <header className="sticky top-0 z-50 bg-[#F7F5EF]/80 dark:bg-black/80 backdrop-blur-md border-b border-black/5 dark:border-white/10 px-4 h-14 flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="font-bold text-lg">내 히스토리</h1>
                </div>
            </header>

            <main className="p-5">
                {/* Search Bar */}
                <div className="relative mb-6">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                        <Search className="w-4 h-4" />
                    </div>
                    <input
                        type="text"
                        placeholder="기록 검색 (제목, 내용)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-11 pl-10 pr-4 rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C4526]/20 transition-all placeholder:text-stone-400"
                    />
                </div>

                {/* Unlockable Features */}
                <div className="mb-8">
                    <RecordTools />
                </div>

                {Object.keys(groupedItems).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-stone-400">
                        {searchTerm ? (
                            <>
                                <Search className="w-10 h-10 mb-2 opacity-20" />
                                <p>검색 결과가 없어요.</p>
                            </>
                        ) : (
                            <>
                                <Clock className="w-10 h-10 mb-2 opacity-20" />
                                <p>아직 기록이 없어요.</p>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="space-y-8">
                        {Object.entries(groupedItems).map(([month, items]) => (
                            <div key={month}>
                                <h2 className="text-xl font-bold text-[#1C4526] dark:text-green-400 mb-4 px-2 sticky top-16 z-10 py-1 drop-shadow-sm">
                                    {month}
                                </h2>
                                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-stone-100 dark:border-zinc-800">
                                    {items.map((item, idx) => (
                                        <TimelineCard key={item.id} item={item} />
                                    ))}
                                </div>
                            </div>
                        ))}

                        {/* Load More Button */}
                        {hasMore && (
                            <div className="py-4 text-center">
                                <Button
                                    variant="outline"
                                    onClick={handleLoadMore}
                                    className="w-full h-12 rounded-xl bg-white dark:bg-zinc-900 border-stone-200 dark:border-zinc-800 text-stone-600 dark:text-stone-300 hover:bg-stone-50 hover:text-stone-800"
                                >
                                    더 보기 <ChevronDown className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        )}

                        {!hasMore && timelineItems.length > 0 && (
                            <div className="py-8 text-center">
                                <p className="text-xs text-stone-300 dark:text-zinc-700">모든 기록을 불러왔습니다.</p>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
