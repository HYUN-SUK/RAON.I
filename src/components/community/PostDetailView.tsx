'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { communityService } from '@/services/communityService';
import { Post } from '@/store/useCommunityStore';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Share2, MoreVertical, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import LikeButton from './LikeButton';
import CommentSection from './CommentSection';

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
                // Increment view count
                const rpcError = await communityService.incrementReadCount(id);
                if (rpcError) alert(`Read Count Error: ${rpcError.message}`);
                // Fetch updated post
                const data = await communityService.getPostById(id);
                setPost(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load post');
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
                <button onClick={() => {
                    if (post?.groupId) {
                        router.push(`/community/groups/${post.groupId}`);
                    } else {
                        router.back();
                    }
                }}>
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
                            post.groupId ? 'bg-[#1C4526] text-white hover:bg-[#15341d]' :
                                'bg-[#F7F5EF] text-[#5C4033] hover:bg-[#F0EFE9]'
                    }>
                        {post.groupId ? '소모임' : post.type}
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
                <div className="whitespace-pre-wrap text-[#333] leading-7 mb-6 min-h-[60px]">
                    {post.content}
                </div>

                {/* Media: Images */}
                {post.images && post.images.length > 0 && (
                    <div className="space-y-2 mb-8">
                        {post.images.map((url: string, index: number) => (
                            <div key={index} className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100 shadow-sm">
                                <img
                                    src={url}
                                    alt={`post-img-${index}`}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Media: Video */}
                {post.type === 'CONTENT' && post.videoUrl && (
                    <div className="mb-8">
                        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black shadow-sm">
                            <iframe
                                width="100%"
                                height="100%"
                                src={`https://www.youtube.com/embed/${getYouTubeId(post.videoUrl)}`}
                                title="YouTube video player"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            ></iframe>
                        </div>
                    </div>
                )}

                {/* Interaction Bar (Left Aligned) */}
                <div className="flex items-center gap-4 py-4 border-b border-gray-100 mb-8">
                    {/* Like Button */}
                    <LikeButton
                        postId={id}
                        likeCount={post.likeCount}
                        initialIsLiked={false}
                        className="text-[#4D4D4D]"
                        onLikeChange={(newCount) => {
                            setPost((prev) => prev ? { ...prev, likeCount: newCount } : null);
                        }}
                    />

                    {/* Stats */}
                    <div className="flex items-center gap-3 text-xs text-[#808080]">
                        <span>댓글 {post.commentCount}</span>
                        <span>조회 {post.readCount || 0}</span>
                    </div>
                </div>

                {/* Comment Section */}
                <CommentSection
                    postId={id}
                    onCommentChange={(newCount) => {
                        setPost((prev) => prev ? { ...prev, commentCount: newCount } : null);
                    }}
                />
            </main>


        </div>
    );
}

// Helper to extract YouTube ID
function getYouTubeId(url: string) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}
