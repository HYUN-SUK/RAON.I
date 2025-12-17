'use client';

import React from 'react';
import Link from 'next/link';
import { Post } from '@/store/useCommunityStore';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, MessageCircle, Eye } from 'lucide-react';

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
        <Link href={`/community/${post.id}`}>
            <Card className="mb-4 overflow-hidden border-none shadow-sm cursor-pointer active:opacity-95 transition-opacity">
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
                            <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-50">
                                <span className="text-2xl">⛺</span>
                            </div>
                        )}
                        {/* Overlay Stats (Optional style, or put below) - Let's put below for clarity like requested */}
                    </div>

                    {/* Content Area */}
                    <div className="p-4 bg-white">
                        <h3 className="font-bold text-gray-900 mb-2 line-clamp-1">{safeTitle}</h3>

                        <div className="flex justify-between items-center text-xs text-gray-500">
                            <div className="flex items-center gap-2">
                                <span>{safeAuthor}</span>
                                <span>•</span>
                                <span>{safeDate}</span>
                            </div>

                            {/* Stats */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                    <Heart className="w-3.5 h-3.5" />
                                    <span>{post.likeCount || 0}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    <span>{post.commentCount || 0}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>{post.readCount || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}
