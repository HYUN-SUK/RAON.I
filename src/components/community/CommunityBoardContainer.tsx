import React, { useEffect, useRef, useState } from 'react';
import { BoardType, useCommunityStore } from '@/store/useCommunityStore';
import StoryBoard from './StoryBoard';
import NoticeBoard from './NoticeBoard';
import ReviewBoard from './ReviewBoard';
import QnaBoard from './QnaBoard';
import GroupBoard from './GroupBoard';
import ContentBoard from './ContentBoard';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';

interface CommunityBoardContainerProps {
    activeTab: BoardType;
}

export default function CommunityBoardContainer({ activeTab }: CommunityBoardContainerProps) {
    const { getPostsByType, loadPosts, page, hasMore, isLoading } = useCommunityStore();
    const posts = getPostsByType(activeTab) || [];
    const [isAdmin, setIsAdmin] = useState(false);

    // 사용자 관리자 세션 1회 조회
    useEffect(() => {
        const checkAdmin = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user && (user.email === 'admin@raon.ai' || user.user_metadata?.role === 'admin')) {
                setIsAdmin(true);
            }
        };
        checkAdmin();
    }, []);

    // Intersection Observer for Infinite Scroll
    const observerTarget = useRef<HTMLDivElement>(null);
    const isFetching = useRef(false); // Ref to prevent double fetch

    useEffect(() => {
        isFetching.current = false; // Reset on tab change or posts change
    }, [posts]);

    // State-Ref pattern to prevent multiple observer teardown/setup GC overhead
    const hasMoreRef = useRef(hasMore);
    const isLoadingRef = useRef(isLoading);
    const pageRef = useRef(page);
    const activeTabRef = useRef(activeTab);

    useEffect(() => {
        hasMoreRef.current = hasMore;
        isLoadingRef.current = isLoading;
        pageRef.current = page;
        activeTabRef.current = activeTab;
    }, [hasMore, isLoading, page, activeTab]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMoreRef.current && !isLoadingRef.current && !isFetching.current) {
                    isFetching.current = true;
                    loadPosts(activeTabRef.current, pageRef.current + 1);
                }
            },
            { threshold: 1.0 }
        );

        const currentTarget = observerTarget.current;
        if (currentTarget) {
            observer.observe(currentTarget);
        }

        return () => {
            if (currentTarget) {
                observer.unobserve(currentTarget);
            }
        };
    }, [loadPosts]);


    const INFINITE_SCROLL_TYPES: BoardType[] = ['STORY', 'REVIEW', 'CONTENT'];
    const isInfinite = INFINITE_SCROLL_TYPES.includes(activeTab);

    // Render Board
    const renderBoard = () => {
        switch (activeTab) {
            case 'STORY': return <StoryBoard posts={posts} isAdmin={isAdmin} />;
            case 'NOTICE': return <NoticeBoard posts={posts} isAdmin={isAdmin} />;
            case 'REVIEW': return <ReviewBoard posts={posts} isAdmin={isAdmin} />;
            case 'QNA': return <QnaBoard posts={posts} isAdmin={isAdmin} />;
            case 'GROUP': return <GroupBoard posts={posts} />;
            case 'CONTENT': return <ContentBoard posts={posts} />;
            default: return <StoryBoard posts={posts} isAdmin={isAdmin} />;
        }
    };

    return (
        <ErrorBoundary name={`${activeTab} Board`}>
            {renderBoard()}

            {/* Pagination Control: Infinite Scroll vs Numbered Buttons */}
            {isInfinite ? (
                // Infinite Scroll Loader
                <div ref={observerTarget} className="py-6 flex justify-center w-full">
                    {isLoading && <Loader2 className="w-6 h-6 animate-spin text-[#1C4526]" />}
                    {!isLoading && !hasMore && posts.length > 0 && (
                        <span className="text-xs text-[#999]">모든 게시물을 불러왔습니다.</span>
                    )}
                </div>
            ) : (
                // Numbered Pagination (Simple Mock UI)
                <div className="py-8 flex justify-center gap-2">
                    {/* Mock Pagination Buttons */}
                    {[1, 2, 3].map((p) => (
                        <button
                            key={p}
                            onClick={() => loadPosts(activeTab, p)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${page === p
                                ? 'bg-[#1C4526] text-white'
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            )}
        </ErrorBoundary>
    );
}
