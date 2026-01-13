'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { communityService } from '@/services/communityService';
import { Post } from '@/store/useCommunityStore';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Share2, MoreVertical, Loader2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import LikeButton from './LikeButton';
import { EmberButton } from '@/components/mission/EmberButton';
import CommentSection from './CommentSection';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { createClient } from '@/lib/supabase-client';

export default function PostDetailView() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    useEffect(() => {
        checkAdmin();
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

    const checkAdmin = async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setCurrentUserId(user.id);
            // Simple Admin Check (Matches Middleware Logic approximately)
            if (user.email === 'admin@raon.ai' || user.user_metadata?.role === 'admin') {
                setIsAdmin(true);
            }
        }
    };

    const handleDelete = async () => {
        try {
            await communityService.deletePost(id);
            // alert('게시물이 삭제되었습니다.'); // UX Polish
            router.back();
        } catch (e: any) {
            console.error(e);
            alert('삭제 실패: ' + e.message);
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center min-h-screen">
            <Loader2 className="w-8 h-8 animate-spin text-[#1C4526]" />
        </div>
    );

    if (error || !post) return (
        <div className="flex flex-col justify-center items-center min-h-screen p-5 text-center bg-[#F7F5EF]">
            <div className="w-16 h-16 rounded-full bg-stone-200 flex items-center justify-center mb-4">
                <Trash2 className="w-8 h-8 text-stone-400" />
            </div>
            <h2 className="text-lg font-bold text-stone-700 mb-2">
                {error ? '오류가 발생했어요' : '삭제된 게시글이에요'}
            </h2>
            <p className="text-sm text-stone-500 mb-6">
                {error || '이 게시글은 삭제되었거나 더 이상 존재하지 않아요.'}
            </p>
            <Button
                onClick={() => router.back()}
                className="bg-[#1C4526] hover:bg-[#15341d] text-white"
            >
                돌아가기
            </Button>
        </div>
    );

    // Check ownership
    // Note: Post type from store might not have authorId? 
    // communityService mapDbToPost doesn't map author_id. We need to check mapDbToPost or just rely on isAdmin.
    // Ideally we should add authorId to Post interface.
    // For now, let's rely on isAdmin for global delete. 
    // If we want owner delete, we need authorId.
    // Let's assume isAdmin is the key requirement now.

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
                    {(isAdmin) && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="p-1 hover:bg-gray-100 rounded-full"><MoreVertical className="w-5 h-5 text-[#1A1A1A]" /></button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer">
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            삭제하기 (Admin)
                                        </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>게시물 삭제</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                정말 이 게시물을 삭제하시겠습니까?<br />
                                                관리자 권한으로 삭제 시 복구할 수 없습니다.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>취소</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                                                삭제
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
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

                    {/* Ember Button (for other users' posts only) */}
                    {post.authorId && currentUserId && post.authorId !== currentUserId && (
                        <EmberButton
                            receiverId={post.authorId}
                            targetId={post.id}
                            targetType="post"
                            receiverName={post.author}
                        />
                    )}

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
