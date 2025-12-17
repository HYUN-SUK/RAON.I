'use client';

import React from 'react';
import { Post } from '@/store/useCommunityStore';
import PostCard from './PostCard';
import { sanitizePost } from '@/utils/communityUtils';

interface BoardProps {
    posts: Post[];
}

export default function GroupBoard({ posts }: BoardProps) {
    const rawPosts = Array.isArray(posts) ? posts : [];
    const safePosts = rawPosts.map(sanitizePost);

    if (safePosts.length === 0) {
        return (
            <div className="py-20 text-center text-[#999]">
                <p>참여할 수 있는 소모임이 없습니다. ⛺</p>
                <p className="text-sm mt-1">새로운 모임을 만들어보세요!</p>
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
