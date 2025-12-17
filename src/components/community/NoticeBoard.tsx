'use client';

import React from 'react';
import { Post } from '@/store/useCommunityStore';
import PostCard from './PostCard';
import { sanitizePost } from '@/utils/communityUtils';

interface BoardProps {
    posts: Post[];
}

export default function NoticeBoard({ posts }: BoardProps) {
    const rawPosts = Array.isArray(posts) ? posts : [];
    const safePosts = rawPosts.map(sanitizePost);

    if (safePosts.length === 0) {
        return (
            <div className="py-20 text-center text-[#999]">
                <p>등록된 공지사항이 없습니다.</p>
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
