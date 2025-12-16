'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { communityService } from '@/services/communityService';
import { Post } from '@/store/useCommunityStore';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Heart, MessageCircle, Share2, MoreVertical, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function PostDetailView() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchPost() {
            if (!id) return;
            try {
                setLoading(true);
                const data = await communityService.getPostById(id);
                setPost(data);
            } catch (err: any) {
                setError(err.message || 'Failed to load post');
            } finally {
                setLoading(false);
            }
        }
        fetchPost();
    }, [id]);

    if (loading) return (
        <div className="flex justify-center items-center min-h-screen">
            <Loader2 className="w-8 h-8 animate-spin text-[#1C4526]" />
        </div>
    );

    if (error || !post) return (
        <div className="flex flex-col justify-center items-center min-h-screen p-5 text-center">
            <p className="text-red-500 mb-4">{error || 'Post not found'}</p>
            <Button onClick={() => router.back()}>Back</Button>
        </div>
    );

    return (
        <div className="min-h-screen bg-white pb-20">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b px-4 h-14 flex items-center justify-between">
                <button onClick={() => router.back()}>
                    <ArrowLeft className="w-6 h-6 text-[#1A1A1A]" />
                </button>
                <div className="flex gap-2">
                    <button><Share2 className="w-5 h-5 text-[#1A1A1A]" /></button>
                    <button><MoreVertical className="w-5 h-5 text-[#1A1A1A]" /></button>
                </div>
            </header>

            <main className="px-5 py-6">
                {/* Category & Date */}
                <div className="flex items-center gap-2 mb-3">
                    <Badge className={
                        post.type === 'NOTICE' ? 'bg-[#E35935] hover:bg-[#E35935]' :
                            'bg-[#F7F5EF] text-[#5C4033] hover:bg-[#F0EFE9]'
                    }>
                        {post.type}
                    </Badge>
                    <span className="text-xs text-[#808080]">{post.date}</span>
                </div>

                {/* Title */}
                <h1 className="text-xl font-bold text-[#1A1A1A] mb-4 leading-relaxed">
                    {post.title}
                </h1>

                {/* Author */}
                <div className="flex items-center gap-2 mb-6 border-b pb-6 border-[#F0EFE9]">
                    <div className="w-8 h-8 rounded-full bg-gray-200"></div> {/* Avatar Placeholder */}
                    <div>
                        <p className="text-sm font-semibold text-[#1A1A1A]">{post.author}</p>
                        <p className="text-xs text-[#808080]">Lv.1 Camper</p>
                    </div>
                </div>

                {/* Content */}
                <div className="whitespace-pre-wrap text-[#333] leading-7 mb-8 min-h-[100px]">
                    {post.content}
                </div>

                {/* Images would go here */}

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-[#808080] mb-8">
                    <span>좋아요 {post.likeCount}</span>
                    <span>댓글 {post.commentCount}</span>
                    <span>조회 {post.readCount || 0}</span>
                </div>
            </main>

            {/* Footer Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button className="flex items-center gap-1 text-[#4D4D4D]">
                        <Heart className="w-6 h-6" />
                        <span className="text-xs font-medium">공감</span>
                    </button>
                    <button className="flex items-center gap-1 text-[#4D4D4D]">
                        <MessageCircle className="w-6 h-6" />
                        <span className="text-xs font-medium">댓글</span>
                    </button>
                </div>
                <Button className="bg-[#1C4526] text-white rounded-full px-6">
                    예약하러 가기
                </Button>
            </div>
        </div>
    );
}
