'use client';

import React from 'react';
import { Post } from '@/store/useCommunityStore';
import PostCard from './PostCard';
import { sanitizePost } from '@/utils/communityUtils';

interface BoardProps {
    posts: Post[];
}

export default function QnaBoard({ posts, isAdmin }: BoardProps & { isAdmin: boolean }) {
    const rawPosts = Array.isArray(posts) ? posts : [];
    const safePosts = rawPosts.map(sanitizePost);

    if (safePosts.length === 0) {
        return (
            <div className="py-20 text-center text-[#999]">
                <p>궁금한 점이 있으신가요? 🤔</p>
                <p className="text-sm mt-1">무엇이든 물어보세요!</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-20">
            {safePosts.map((post) => (
                <PostCard key={post.id} post={post} isAdmin={isAdmin} />
            ))}
        </div>
    );
}
