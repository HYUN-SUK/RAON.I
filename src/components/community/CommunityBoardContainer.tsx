import React, { useEffect, useRef } from 'react';
import { BoardType, useCommunityStore } from '@/store/useCommunityStore';
import StoryBoard from './StoryBoard';
import NoticeBoard from './NoticeBoard';
import ReviewBoard from './ReviewBoard';
import QnaBoard from './QnaBoard';
import GroupBoard from './GroupBoard';
import ContentBoard from './ContentBoard';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { Loader2 } from 'lucide-react';

interface CommunityBoardContainerProps {
    activeTab: BoardType;
}

export default function CommunityBoardContainer({ activeTab }: CommunityBoardContainerProps) {
    const { getPostsByType, loadPosts, page, hasMore, isLoading } = useCommunityStore();
    const posts = getPostsByType(activeTab) || [];

    // Intersection Observer for Infinite Scroll
    const observerTarget = useRef<HTMLDivElement>(null);
    const isFetching = useRef(false); // Ref to prevent double fetch

    useEffect(() => {
        isFetching.current = false; // Reset on tab change or posts change
    }, [posts]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore && !isLoading && !isFetching.current) {
                    isFetching.current = true;
                    loadPosts(activeTab, page + 1);
                }
            },
            { threshold: 1.0 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => {
            if (observerTarget.current) {
                observer.unobserve(observerTarget.current);
            }
        };
    }, [hasMore, isLoading, activeTab, page, loadPosts]);


    const INFINITE_SCROLL_TYPES: BoardType[] = ['STORY', 'REVIEW', 'CONTENT'];
    const isInfinite = INFINITE_SCROLL_TYPES.includes(activeTab);

    // Render Board
    const renderBoard = () => {
        switch (activeTab) {
            case 'STORY': return <StoryBoard posts={posts} />;
            case 'NOTICE': return <NoticeBoard posts={posts} />;
            case 'REVIEW': return <ReviewBoard posts={posts} />;
            case 'QNA': return <QnaBoard posts={posts} />;
            case 'GROUP': return <GroupBoard posts={posts} />;
            case 'CONTENT': return <ContentBoard posts={posts} />;
            default: return <StoryBoard posts={posts} />;
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
