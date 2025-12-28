'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useCommunityStore } from '@/store/useCommunityStore';
import { ArrowLeft, Grid, LayoutList, Heart, MessageCircle, Search } from 'lucide-react';
import Image from 'next/image';

export default function MyRecordPage() {
    const router = useRouter();
    const { getMyPosts, currentUser } = useCommunityStore();
    const myPosts = getMyPosts();

    // State for Search
    const [searchTerm, setSearchTerm] = React.useState('');
    // Pagination (Client-side simulation for now as requested)
    const [visibleCount, setVisibleCount] = React.useState(15);

    const filteredPosts = React.useMemo(() => {
        if (searchTerm.trim() === '') {
            return myPosts;
        }
        const term = searchTerm.toLowerCase();
        return myPosts.filter(p =>
            p.title?.toLowerCase().includes(term) ||
            p.content?.toLowerCase().includes(term)
        );
    }, [searchTerm, myPosts]);

    const displayedPosts = filteredPosts.slice(0, visibleCount);
    const hasMore = visibleCount < filteredPosts.length;

    return (
        <div className="min-h-screen bg-[#FDFBF7] pb-20 font-sans">
            {/* Header with Search */}
            <div className="bg-[#FDFBF7] sticky top-0 z-10 px-4 h-16 flex items-center justify-between border-b border-[#ECE8DF]">
                <button onClick={() => router.back()} className="p-2 -ml-2 text-stone-600 hover:bg-stone-100 rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>

                <div className="flex-1 mx-4 relative">
                    <input
                        type="text"
                        placeholder="기록 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#F5F2EB] border-none rounded-full py-2 pl-4 pr-10 text-sm focus:ring-1 focus:ring-stone-300 placeholder:text-stone-400"
                    />
                    <Search className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
            </div>

            {/* Profile Summary */}
            <div className="bg-[#FDFBF7] px-6 pt-6 pb-8 text-center border-b border-[#ECE8DF] mb-0">
                <div className="w-24 h-24 rounded-full bg-white mx-auto mb-4 overflow-hidden relative shadow-sm border-4 border-white">
                    {(currentUser as any)?.image ? (
                        <img src={(currentUser as any).image} alt={currentUser.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-[#1C4526]/40 bg-[#F5F2EB]">
                            {currentUser.name?.[0]}
                        </div>
                    )}
                </div>

                <h2 className="text-xl font-bold text-[#2C2C2C] mb-2">{currentUser.name}</h2>
                <div className="text-sm text-stone-500 mb-6">
                    <span className="font-medium text-[#1C4526]">{myPosts.length}</span>개의 기록이 보관되어 있습니다.
                </div>

                <p className="text-sm text-stone-600 leading-relaxed font-serif italic text-opacity-80">
                    "내가 작성했던 모든 기록들이<br />모여있는 공간입니다."
                </p>
            </div>

            {/* Full Width Content Grid */}
            <div className="grid grid-cols-3 gap-0.5">
                {displayedPosts.length > 0 ? (
                    displayedPosts.map((post) => (
                        <div
                            key={post.id}
                            onClick={() => router.push(`/community/${post.id}`)}
                            className="aspect-square relative bg-stone-200 cursor-pointer group overflow-hidden"
                        >
                            {post.images && post.images.length > 0 ? (
                                <Image
                                    src={post.images[0]}
                                    alt={post.title}
                                    fill
                                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                            ) : (
                                <div className="w-full h-full bg-[#F5F2EB] flex flex-col items-center justify-center p-3 text-center">
                                    <span className="text-xs text-stone-400 line-clamp-3 font-serif leading-relaxed">
                                        {post.content}
                                    </span>
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="col-span-3 py-32 text-center text-stone-400">
                        {searchTerm ? (
                            <p>검색 결과가 없습니다.</p>
                        ) : (
                            <div>
                                <p className="mb-4">아직 작성한 기록이 없습니다.</p>
                                <button
                                    onClick={() => router.push('/community/write?type=STORY')}
                                    className="px-6 py-2 bg-[#1C4526] text-white rounded-full text-sm font-bold shadow-md active:scale-95 transition-transform"
                                >
                                    첫 기록 남기기
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Load More Button */}
            {hasMore && (
                <div className="py-8 text-center bg-[#FDFBF7]">
                    <button
                        onClick={() => setVisibleCount(prev => prev + 15)}
                        className="px-8 py-3 bg-white border border-[#ECE8DF] rounded-full text-stone-600 text-sm font-medium shadow-sm hover:bg-stone-50 active:scale-95 transition-all"
                    >
                        더 보기
                    </button>
                </div>
            )}
        </div>
    );
}
