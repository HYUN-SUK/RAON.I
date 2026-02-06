"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit, Search, PlusCircle, Sparkles, Loader2 } from 'lucide-react';
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

export default function MyRecordsPage() {
    const router = useRouter();

    // Tab State
    const [activeTab, setActiveTab] = useState<TabType>('posts');

    // Posts State
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isSearchOpen, setIsSearchOpen] = useState(false);

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
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, []);

    // Fetch Camping Records
    const fetchCampingRecords = useCallback(async () => {
        setIsLoadingRecords(true);
        try {
            const data = await getMyRecords(50, 0);
            setCampingRecords(data);
        } catch (err) {
            console.error('Failed to load camping records:', err);
        } finally {
            setIsLoadingRecords(false);
        }
    }, []);

    // Initial Load based on tab
    useEffect(() => {
        if (activeTab === 'posts') {
            fetchPosts(0, '');
        } else {
            fetchCampingRecords();
        }
    }, [fetchPosts, fetchCampingRecords, activeTab]);

    // Handle Search
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchKeyword(val);
        setPage(0);

        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        searchTimeoutRef.current = setTimeout(() => {
            fetchPosts(0, val);
        }, 500);
    };

    // Handle Load More
    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchPosts(nextPage, searchKeyword, true);
    };

    return (
        <div className="min-h-screen bg-[#F0EBE0] dark:bg-[#1a1a1a] pb-20 font-serif relative">
            {/* Paper Texture Overlay */}
            <div className="fixed inset-0 pointer-events-none opacity-30 mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]"></div>

            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#F0EBE0]/90 dark:bg-[#1a1a1a]/90 backdrop-blur-md px-4 h-14 flex items-center justify-between border-b border-stone-300 dark:border-stone-800">
                <div className="flex items-center gap-3 flex-1">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 text-stone-700 hover:bg-stone-200/50 dark:text-stone-300 dark:hover:bg-white/10 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>

                    {isSearchOpen ? (
                        <div className="flex-1 max-w-[200px] animate-in fade-in slide-in-from-right-4 duration-300">
                            <Input
                                autoFocus
                                value={searchKeyword}
                                onChange={handleSearchChange}
                                placeholder="기록 검색..."
                                className="h-8 text-sm bg-transparent border-none focus-visible:ring-0 placeholder:text-stone-400"
                            />
                        </div>
                    ) : (
                        <h1 className="font-bold text-lg text-[#2C2C2C] dark:text-stone-200 font-serif tracking-tight">나만의 아카이브</h1>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsSearchOpen(!isSearchOpen)}
                        className={`p-2 rounded-full transition-colors ${isSearchOpen ? 'text-[#1C4526] bg-stone-200/50' : 'text-stone-600'}`}
                    >
                        <Search className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => router.push('/community/write?type=STORY')}
                        className="p-2 text-[#1C4526] hover:bg-green-50 rounded-full"
                    >
                        <Edit className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <main className="px-5 pt-6 space-y-6 relative z-10">
                {/* Intro Section */}
                <div className="space-y-4">
                    <div className="bg-white p-6 shadow-sm border border-stone-200 rotate-[0.5deg]">
                        <h2 className="text-xl font-bold text-[#1C4526] mb-2 font-serif">나의 기록 보관소</h2>
                        <p className="text-stone-600 text-sm leading-relaxed font-serif">
                            &quot;이곳은 내가 작성한 모든 기록을 볼 수 있는 나만의 소중한 공간입니다.<br />
                            지난 추억을 되돌아보고, 새로운 이야기를 채워보세요.&quot;
                        </p>
                    </div>

                    {/* Collapsible Tools */}
                    <RecordTools />

                    {/* Tab Selector */}
                    <div className="flex bg-stone-200/50 rounded-lg p-1">
                        <button
                            onClick={() => setActiveTab('posts')}
                            className={cn(
                                'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5',
                                activeTab === 'posts'
                                    ? 'bg-white text-[#1C4526] shadow-sm'
                                    : 'text-stone-500 hover:text-stone-700'
                            )}
                        >
                            <Edit className="w-4 h-4" />
                            글 기록
                        </button>
                        <button
                            onClick={() => setActiveTab('records')}
                            className={cn(
                                'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5',
                                activeTab === 'records'
                                    ? 'bg-white text-[#1C4526] shadow-sm'
                                    : 'text-stone-500 hover:text-stone-700'
                            )}
                        >
                            <Sparkles className="w-4 h-4" />
                            1분 기록
                        </button>
                    </div>
                </div>

                {/* Posts List (글 기록 탭) */}
                {activeTab === 'posts' && (
                    <div className="space-y-4 pt-2">
                        {isLoading ? (
                            <div className="flex justify-center py-20">
                                <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
                            </div>
                        ) : posts.length > 0 ? (
                            <>
                                {posts.map(post => (
                                    <div key={post.id}>
                                        <PostCard post={post} />
                                    </div>
                                ))}

                                {hasMore && (
                                    <div className="pt-4 pb-8 flex justify-center">
                                        <button
                                            onClick={handleLoadMore}
                                            disabled={isLoadingMore}
                                            className="flex items-center gap-2 px-6 py-3 bg-[#F7F5EF] border border-[#C3A675] text-[#8C7B58] rounded-full hover:bg-[#F0EBE0] active:scale-95 transition-all text-sm font-bold shadow-sm"
                                        >
                                            {isLoadingMore ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <PlusCircle className="w-4 h-4" />
                                            )}
                                            더 보기
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="py-20 text-center text-stone-400 border-2 border-dashed border-stone-200 rounded-xl m-2">
                                <p className="mb-2 font-serif">아직 보관된 기록이 없습니다.</p>
                                <button
                                    onClick={() => router.push('/community/write?type=STORY')}
                                    className="text-sm font-bold text-[#1C4526] underline hover:text-green-700"
                                >
                                    첫 기록 남기기
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Camping Records List (1분 기록 탭) */}
                {activeTab === 'records' && (
                    <div className="space-y-6 pt-2">
                        {isLoadingRecords ? (
                            <div className="flex justify-center py-20">
                                <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
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
                                <p className="mb-2 font-serif">아직 1분 기록이 없습니다.</p>
                                <p className="text-sm">캠핑 후 FAB 버튼을 눌러 기록을 남겨보세요!</p>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
