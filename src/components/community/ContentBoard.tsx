"use client";

import React from 'react';
import { Post } from '@/store/useCommunityStore';
import { ContentBoardList } from './content/ContentBoardList';

interface ContentBoardProps {
    posts: Post[]; // Not used, as ContentBoardList fetches its own data from creator_contents table
}

export default function ContentBoard({ posts }: ContentBoardProps) {
    // We ignore the passed posts because Creator Content system uses a separate table (creator_contents)
    // and a separate service (creatorService).
    // The CommunityBoardContainer structure expects a component that takes posts, so we adapt here.

    return (
        <div className="pb-20">
            <ContentBoardList />
        </div>
    );
}
