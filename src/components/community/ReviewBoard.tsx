'use client';

import React from 'react';
import { Post } from '@/store/useCommunityStore';
import PostCard from './PostCard';
import { sanitizePost } from '@/utils/communityUtils';

interface BoardProps {
    posts: Post[];
}

export default function ReviewBoard({ posts }: BoardProps) {
    const rawPosts = Array.isArray(posts) ? posts : [];
    const safePosts = rawPosts.map(sanitizePost);

    if (safePosts.length === 0) {
        return (
            <div className="py-20 text-center text-[#999]">
                <p>아직 작성된 후기가 없습니다. 📝</p>
                <p className="text-sm mt-1">첫 번째 후기의 주인공이 되어보세요!</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-20">
            {safePosts.map((post) => (
                <PostCard key={post.id} post={post} />
            ))}
        </div>
    );
}
