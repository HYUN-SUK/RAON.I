'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Heart, Users, PlayCircle, Eye } from 'lucide-react';
import { Post } from '@/store/useCommunityStore';
import Image from 'next/image';

interface PostCardProps {
    post: Post;
}

export default function PostCard({ post }: PostCardProps) {
    // Defensive Data Extraction
    const type = post.type || 'STORY';
    const status = (post as any).status || 'OPEN'; // Safe fallback
    const groupName = (post as any).groupName || 'Unknown Group';
    const videoUrl = (post as any).videoUrl;

    // Author safety
    let safeAuthor = '익명';
    if (typeof post.author === 'string') safeAuthor = post.author;
    else if (typeof post.author === 'object') safeAuthor = (post.author as any)?.name || 'Unknown';

    // Image safety
    const safeImages = Array.isArray(post.images)
        ? post.images.filter(img => typeof img === 'string')
        : [];
    const firstImage = safeImages[0];
    const thumbnailUrl = typeof post.thumbnailUrl === 'string' ? post.thumbnailUrl : undefined;

    const isVideo = type === 'CONTENT' && typeof videoUrl === 'string';
    const isGroup = type === 'GROUP';
    const hasMedia = Boolean(thumbnailUrl || firstImage);

    // Helpers for safe rendering
    const safeTitle = typeof post.title === 'string' ? post.title : '제목 없음';
    const safeContent = typeof post.content === 'string' ? post.content : '';
    const safeDate = typeof post.date === 'string' ? post.date : '';
    const safeLikeCount = typeof post.likeCount === 'number' ? post.likeCount : 0;
    const safeCommentCount = typeof post.commentCount === 'number' ? post.commentCount : 0;
    const safeReadCount = typeof post.readCount === 'number' ? post.readCount : 0;

    return (
        <Link href={`/community/${post.id}`}>
            <Card className="mb-3 border-none shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer bg-white">
                <CardContent className="p-4">
                    {/* Header / Meta */}
                    <div className="flex justify-between items-start mb-2">
                        {type === 'NOTICE' ? (
                            <Badge variant="secondary" className="bg-[#1C4526] text-white hover:bg-[#1C4526]/90">
                                공지
                            </Badge>
                        ) : type === 'QNA' ? (
                            <Badge variant={status === 'CLOSED' ? "outline" : "default"} className={status === 'OPEN' ? "bg-[#C3A675] text-white" : "text-[#999] border-[#999]"}>
                                {status === 'OPEN' ? '답변대기' : '해결됨'}
                            </Badge>
                        ) : (
                            <div className="flex items-center gap-2">
                                {isGroup && <Badge variant="outline" className="text-[#1C4526] border-[#1C4526]">{groupName}</Badge>}
                                <span className="text-xs text-[#999]">{safeDate}</span>
                            </div>
                        )}

                        <div className="flex items-center gap-1 text-xs text-[#999]">
                            <span>by {safeAuthor}</span>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <h3 className="text-[16px] font-bold text-[#1A1A1A] mb-1 line-clamp-1">
                                {safeTitle}
                            </h3>
                            <p className="text-[14px] text-[#4D4D4D] line-clamp-2 font-light">
                                {safeContent}
                            </p>
                        </div>

                        {hasMedia && (
                            <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                                <Image
                                    src={thumbnailUrl || firstImage || ''}
                                    alt="thumbnail"
                                    fill
                                    className="object-cover"
                                />
                                {isVideo && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                        <PlayCircle className="w-8 h-8 text-white/90" />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer actions */}
                    <div className="mt-3 flex items-center gap-4 text-[#999]">
                        {/* Sympathy (Like) */}
                        <div className="flex items-center gap-1 text-xs">
                            <Heart className="w-3.5 h-3.5" />
                            <span>{safeLikeCount}</span>
                        </div>

                        <div className="flex items-center gap-1 text-xs">
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>{safeCommentCount}</span>
                        </div>

                        {/* Read Count */}
                        <div className="flex items-center gap-1 text-xs">
                            <Eye className="w-3.5 h-3.5" />
                            <span>{safeReadCount}</span>
                        </div>

                        {/* Group Join / Members */}
                        {isGroup && (
                            <div className="ml-auto flex items-center gap-1 text-xs text-[#1C4526] font-medium">
                                <Users className="w-3.5 h-3.5" />
                                <span>함께하기</span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}
