"use client";

import React, { useState, useEffect } from 'react';
import { creatorService } from '@/services/creatorService';
import { CreatorContent, Creator, CreatorContentType } from '@/types/creator';
import { ContentCard } from './ContentCard';
import { Loader2, Flame, PenTool } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export function ContentBoardList() {
    const router = useRouter();
    const [contents, setContents] = useState<(CreatorContent & { creators: Creator })[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<CreatorContentType | 'ALL'>('ALL');

    useEffect(() => {
        fetchContents();
    }, []);

    const fetchContents = async () => {
        try {
            setLoading(true);
            const data = await creatorService.getContents('PUBLISHED');
            setContents(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const filteredContents = filter === 'ALL'
        ? contents
        : contents.filter(c => c.type === filter);

    // Mock "Today's Bonfire" (Random or Pinned) - For now just take the first one or random
    const todaysPick = contents.length > 0 ? contents[0] : null;

    return (
        <div className="space-y-8 pb-20">

            {/* 1. Today's Bonfire (Hero Selection) */}
            {todaysPick && filter === 'ALL' && (
                <section className="px-4 pt-2">
                    <div className="flex items-center gap-2 mb-3">
                        <Flame className="w-5 h-5 text-[#C3A675]" />
                        <h2 className="text-lg font-bold text-[#1C4526]">오늘의 모닥불</h2>
                    </div>
                    <div
                        className="relative aspect-video rounded-2xl overflow-hidden shadow-md cursor-pointer group"
                        onClick={() => router.push(`/community/content/${todaysPick.id}`)}
                    >
                        <img
                            src={todaysPick.cover_image_url || '/placeholder-bonfire.jpg'}
                            alt={todaysPick.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        <div className="absolute bottom-4 left-4 right-4 text-white">
                            <span className="inline-block px-2 py-0.5 rounded-full bg-[#C3A675] text-[#1C4526] text-[10px] font-bold mb-2">
                                Editor's Pick
                            </span>
                            <h3 className="text-xl font-bold mb-1">{todaysPick.title}</h3>
                            <p className="text-sm text-gray-200 line-clamp-1">{todaysPick.description}</p>
                        </div>
                    </div>
                </section>
            )}

            {/* 2. Filters */}
            <section className="px-4 sticky top-14 z-40 bg-[#F7F5EF]/95 backdrop-blur-sm py-2 -mx-4 px-8 border-b border-[#ECE8DF] overflow-x-auto no-scrollbar">
                <div className="flex gap-2 min-w-max">
                    {['ALL', 'LIVE', 'NOVEL', 'WEBTOON', 'ESSAY'].map((t) => (
                        <button
                            key={t}
                            onClick={() => setFilter(t as any)}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === t
                                    ? 'bg-[#1C4526] text-white shadow-md'
                                    : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            {t === 'ALL' ? '전체' : t}
                        </button>
                    ))}
                </div>
            </section>

            {/* 3. Grid List */}
            <section className="px-4">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-8 h-8 text-[#1C4526] animate-spin" />
                    </div>
                ) : filteredContents.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                        {filteredContents.map(content => (
                            <ContentCard key={content.id} content={content} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 text-gray-400">
                        <p className="mb-4">등록된 콘텐츠가 없습니다.</p>
                        <Button variant="outline" onClick={() => router.push('/community/content/create')}>
                            첫 번째 작가가 되어보세요!
                        </Button>
                    </div>
                )}
            </section>

            {/* Floating Write Button */}
            <div className="fixed bottom-24 right-4 z-40">
                <Button
                    className="rounded-full w-14 h-14 bg-[#1C4526] hover:bg-[#15331d] shadow-xl flex items-center justify-center p-0"
                    onClick={() => router.push('/community/content/create')}
                >
                    <PenTool className="w-6 h-6 text-white" />
                </Button>
            </div>

        </div>
    );
}
