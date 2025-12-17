'use client';

import React from 'react';
import { Post } from '@/store/useCommunityStore';
import { Card, CardContent } from '@/components/ui/card';
import { Heart } from 'lucide-react';

interface StoryCardProps {
    post: Post;
}

export default function StoryCard({ post }: StoryCardProps) {
    // Ultimate Safety Extraction
    const safeTitle = typeof post.title === 'string' ? post.title : 'Untitled';
    const safeDate = typeof post.date === 'string' ? post.date : 'Unknown Date';
    // Handle potential object in author
    const safeAuthor = typeof post.author === 'string'
        ? post.author
        : (post.author as any)?.name || 'Anonymous';

    // Images
    const rawImages = Array.isArray(post.images) ? post.images : [];
    const safeImages = rawImages.filter(img => typeof img === 'string');
    const firstImage = safeImages.length > 0 ? safeImages[0] : null;
    const thumbnail = typeof post.thumbnailUrl === 'string' ? post.thumbnailUrl : firstImage;

    return (
        <Card className="mb-4 overflow-hidden border-none shadow-sm">
            <CardContent className="p-0">
                {/* Image Area */}
                <div className="relative w-full aspect-video bg-gray-100">
                    {thumbnail ? (
                        <img
                            src={thumbnail}
                            alt={safeTitle}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                            No Image
                        </div>
                    )}
                </div>

                {/* Content Area */}
                <div className="p-4 bg-white">
                    <h3 className="font-bold text-gray-900 mb-1">{safeTitle}</h3>
                    <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>{safeAuthor}</span>
                        <span>{safeDate}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
