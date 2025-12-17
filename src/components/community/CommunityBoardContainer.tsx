import React from 'react';
import { BoardType, useCommunityStore } from '@/store/useCommunityStore';
import StoryBoard from './StoryBoard';
import NoticeBoard from './NoticeBoard';
import ReviewBoard from './ReviewBoard';
import QnaBoard from './QnaBoard';
import GroupBoard from './GroupBoard';
import ContentBoard from './ContentBoard';
import { ErrorBoundary } from '@/components/ui/error-boundary';

interface CommunityBoardContainerProps {
    activeTab: BoardType;
}

export default function CommunityBoardContainer({ activeTab }: CommunityBoardContainerProps) {
    const { getPostsByType } = useCommunityStore();
    // Force re-fetch/reset logic could be here, but store handles it.
    // However, to prevent stale data flash, we can use a key.
    const posts = getPostsByType(activeTab) || [];

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
        </ErrorBoundary>
    );
}
