'use client';

import React from 'react';
import { Post } from '@/store/useCommunityStore';
import StoryCard from './StoryCard';

interface StoryBoardProps {
    posts: Post[];
}

export default function StoryBoard({ posts }: StoryBoardProps) {
    // Robust safety check & Sanitization
    const rawPosts = Array.isArray(posts) ? posts : [];

    // Sanitize posts to prevent crash from malformed data
    // Even though StoryCard handles it, sanitizing here is double safety.
    const safePosts = rawPosts.map(p => {
        let safeAuthor = 'Anonymous';
        if (typeof p.author === 'string') safeAuthor = p.author;
        else if (typeof p.author === 'object') {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                safeAuthor = (p.author as any)?.name || (p.author as any)?.nickname || 'Unknown Author';
            } catch {
                safeAuthor = 'Invalid Author Data';
            }
        }

        let safeImages: string[] = [];
        if (Array.isArray(p.images)) {
            safeImages = p.images.filter(img => typeof img === 'string');
        }

        return {
            ...p,
            author: safeAuthor,
            images: safeImages,
            thumbnailUrl: typeof p.thumbnailUrl === 'string' ? p.thumbnailUrl : undefined,
            title: typeof p.title === 'string' ? p.title : 'Untitled',
            content: typeof p.content === 'string' ? p.content : '',
            date: typeof p.date === 'string' ? p.date : 'Unknown Date'
        };
    });

    if (safePosts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-[#999]">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-2xl">
                    🍂
                </div>
                <p className="font-medium">아직 올라온 이야기가 없어요.</p>
                <p className="text-sm mt-1">캠핑장의 첫 번째 이야기를 들려주세요.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-20 px-1">
            {safePosts.map((post) => (
                <StoryCard key={post.id} post={post} />
            ))}
        </div>
    );
}
