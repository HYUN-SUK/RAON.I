'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Heart, Users, PlayCircle, Lock } from 'lucide-react';
import { Post } from '@/store/useCommunityStore';
import Image from 'next/image';

interface PostCardProps {
    post: Post;
}

export default function PostCard({ post }: PostCardProps) {
    const isVideo = post.type === 'CONTENT' && post.videoUrl;
    const isGroup = post.type === 'GROUP';

    return (
        <Card className="mb-3 border-none shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer bg-white">
            <CardContent className="p-4">
                {/* Header / Meta */}
                <div className="flex justify-between items-start mb-2">
                    {post.type === 'NOTICE' ? (
                        <Badge variant="secondary" className="bg-[#1C4526] text-white hover:bg-[#1C4526]/90">
                            공지
                        </Badge>
                    ) : post.type === 'QNA' ? (
                        <Badge variant={post.status === 'CLOSED' ? "outline" : "default"} className={post.status === 'OPEN' ? "bg-[#C3A675] text-white" : "text-[#999] border-[#999]"}>
                            {post.status === 'OPEN' ? '답변대기' : '해결됨'}
                        </Badge>
                    ) : (
                        <div className="flex items-center gap-2">
                            {isGroup && <Badge variant="outline" className="text-[#1C4526] border-[#1C4526]">{post.groupName}</Badge>}
                            <span className="text-xs text-[#999]">{post.date}</span>
                        </div>
                    )}

                    <div className="flex items-center gap-1 text-xs text-[#999]">
                        <span>by {post.author}</span>
                    </div>
                </div>

                {/* Content */}
                <div className="flex gap-4">
                    <div className="flex-1">
                        <h3 className="text-[16px] font-bold text-[#1A1A1A] mb-1 line-clamp-1">
                            {post.title}
                        </h3>
                        <p className="text-[14px] text-[#4D4D4D] line-clamp-2 font-light">
                            {post.content}
                        </p>
                    </div>

                    {(post.images?.[0] || post.thumbnailUrl) && (
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                            <Image
                                src={post.thumbnailUrl || post.images![0]}
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
                        <span>{post.likeCount}</span>
                    </div>

                    {/* Comments */}
                    <div className="flex items-center gap-1 text-xs">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{post.commentCount}</span>
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
    );
}
