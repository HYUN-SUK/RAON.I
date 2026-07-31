"use client";

import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Edit, Search, PlusCircle, Sparkles, Loader2, Grid, Calendar, List, PenLine } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { communityService } from '@/services/communityService';
import { Post } from '@/store/useCommunityStore';
import PostCard from '@/components/community/PostCard';
import RecordTools from '@/components/myspace/RecordTools';
import AjiitCard from '@/components/record/AjiitCard';
import { getMyRecords, CampingRecord } from '@/actions/record';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type TabType = 'posts' | 'records';

function MyRecordsContent() {
    const router = useRouter();

    // Tab State - URL Param Support
    const searchParams = useSearchParams();
    const initialTab = searchParams.get('tab') as TabType;
    const [activeTab, setActiveTab] = useState<TabType>(initialTab === 'records' ? 'records' : 'posts');

    // Posts State
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    // Camping Records State
    const [campingRecords, setCampingRecords] = useState<CampingRecord[]>([]);
    const [isLoadingRecords, setIsLoadingRecords] = useState(false);

    // Debounce Search
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const fetchPosts = useCallback(async (pageNum: number, keyword: string, isLoadMore: boolean = false) => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return;

        try {
            if (isLoadMore) setIsLoadingMore(true);
            else setIsLoading(true);

            const { data, count } = await communityService.getMyPosts(user.id, pageNum, 10, keyword);

            if (isLoadMore) {
                setPosts(prev => [...prev, ...data]);
            } else {
                setPosts(data);
            }

            setHasMore(data.length === 10);
        } catch (error) {
            console.error('Fetch my posts error:', error);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, []);

    const fetchCampingRecords = useCallback(async () => {
        setIsLoadingRecords(true);
        try {
            const data = await getMyRecords();
            setCampingRecords(data);
        } catch (error) {
            console.error('Fetch camping records error:', error);
        } finally {
            setIsLoadingRecords(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'posts') {
            fetchPosts(0, searchKeyword);
        } else if (activeTab === 'records') {
            fetchCampingRecords();
        }
    }, [activeTab, fetchPosts, fetchCampingRecords, searchKeyword]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchKeyword(val);
        setPage(0);

        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => {
            fetchPosts(0, val);
        }, 400);
    };

    const handleLoadMore = () => {
        if (!isLoadingMore && hasMore) {
            const nextPage = page + 1;
            setPage(nextPage);
            fetchPosts(nextPage, searchKeyword, true);
        }
    };

    return (
        <div className="min-h-screen bg-[#F7F5EF] pb-24">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-[#F7F5EF]/90 backdrop-blur-md border-b border-stone-200/50 px-4 h-14 flex items-center justify-between">
                <button
                    onClick={() => router.back()}
                    className="p-2 -ml-2 rounded-full hover:bg-stone-200/50 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-stone-700" />
                </button>
                <h1 className="text-base font-bold text-stone-800 font-serif">나의 수첩 & 파편</h1>
                <div className="w-9" />
            </header>

            <main className="max-w-md mx-auto p-4 space-y-4">
                {/* 탭 버튼 */}
                <div className="flex bg-stone-200/60 p-1 rounded-xl gap-1">
                    <button
                        onClick={() => setActiveTab('posts')}
                        className={cn(
                            "flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5",
                            activeTab === 'posts'
                                ? "bg-white text-stone-800 shadow-sm"
                                : "text-stone-500 hover:text-stone-700"
                        )}
                    >
                        <PenLine className="w-3.5 h-3.5" />
                        피드 파편 ({posts.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('records')}
                        className={cn(
                            "flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5",
                            activeTab === 'records'
                                ? "bg-white text-stone-800 shadow-sm"
                                : "text-stone-500 hover:text-stone-700"
                        )}
                    >
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        10초 아지트 ({campingRecords.length})
                    </button>
                </div>

                {/* 검색 바 (피드 탭에서만) */}
                {activeTab === 'posts' && (
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                        <Input
                            type="text"
                            placeholder="글 제목, 내용으로 검색..."
                            value={searchKeyword}
                            onChange={handleSearchChange}
                            className="pl-9 bg-white border-stone-200 text-xs rounded-xl h-10 shadow-none focus-visible:ring-1 focus-visible:ring-stone-400"
                        />
                    </div>
                )}

                {/* 탭 1: 피드 파편 목록 */}
                {activeTab === 'posts' && (
                    <div className="space-y-3">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-stone-400 space-y-2">
                                <Loader2 className="w-6 h-6 animate-spin text-[#224732]" />
                                <span className="text-xs">내 글을 불러오는 중...</span>
                            </div>
                        ) : posts.length > 0 ? (
                            <>
                                {posts.map(post => (
                                    <PostCard key={post.id} post={post} />
                                ))}
                                {hasMore && (
                                    <button
                                        onClick={handleLoadMore}
                                        disabled={isLoadingMore}
                                        className="w-full py-3 text-xs text-stone-500 font-medium hover:text-stone-800 flex items-center justify-center gap-1"
                                    >
                                        {isLoadingMore ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
                                        ) : (
                                            '더 보기'
                                        )}
                                    </button>
                                )}
                            </>
                        ) : (
                            <div className="py-20 text-center text-stone-400 border-2 border-dashed border-stone-200 rounded-xl m-2">
                                <p className="mb-2 font-serif">작성한 글이 없습니다.</p>
                                <p className="text-sm">커뮤니티에서 첫 이야기를 남겨보세요!</p>
                            </div>
                        )}
                    </div>
                )}

                {/* 탭 2: 10초 아지트 기록 목록 */}
                {activeTab === 'records' && (
                    <div className="space-y-3">
                        {isLoadingRecords ? (
                            <div className="flex flex-col items-center justify-center py-20 text-stone-400 space-y-2">
                                <Loader2 className="w-6 h-6 animate-spin text-[#224732]" />
                                <span className="text-xs">10초 기록을 불러오는 중...</span>
                            </div>
                        ) : campingRecords.length > 0 ? (
                            <>
                                {campingRecords.map(record => (
                                    <AjiitCard
                                        key={record.id}
                                        record={{
                                            ...record,
                                            campground_name: record.campground_name,
                                            campground_address: record.campground_address,
                                        }}
                                    />
                                ))}
                            </>
                        ) : (
                            <div className="py-20 text-center text-stone-400 border-2 border-dashed border-stone-200 rounded-xl m-2">
                                <p className="mb-2 font-serif">아직 10초 기록이 없습니다.</p>
                                <p className="text-sm">캠핑 후 FAB 버튼을 눌러 기록을 남겨보세요!</p>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

export default function MyRecordsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#F7F5EF] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#224732] animate-spin" />
            </div>
        }>
            <MyRecordsContent />
        </Suspense>
    );
}
