import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Heart, Users, PlayCircle, Eye, Trash2 } from 'lucide-react';
import { Post } from '@/store/useCommunityStore';
import Image from 'next/image';
import { createClient } from '@/lib/supabase-client';
import { communityService } from '@/services/communityService';
import { useRouter } from 'next/navigation';
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

interface PostCardProps {
    post: Post;
}

export default function PostCard({ post }: PostCardProps) {
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const checkAdmin = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user && (user.email === 'admin@raon.ai' || user.user_metadata?.role === 'admin')) {
                setIsAdmin(true);
            }
        };
        checkAdmin();
    }, []);

    const executeDelete = async () => {
        try {
            await communityService.deletePost(post.id);
        } catch (error: unknown) {
            console.error(error);
            const message = error instanceof Error ? error.message : '알 수 없는 오류';
            alert('삭제 실패: ' + message);
        }
    };

    // Defensive Data Extraction
    const type = post.type || 'STORY';
    const status = post.status || 'OPEN';
    const groupName = post.groupName || 'Unknown Group'; // defined in Post interface
    const videoUrl = post.videoUrl;

    // Author safety
    const safeAuthor = post.author || '익명';

    // Image safety
    const safeImages = Array.isArray(post.images)
        ? post.images.slice(0, 3).filter((img) => typeof img === 'string')
        : [];
    const firstImage = safeImages[0];
    const thumbnailUrl = post.thumbnailUrl;

    const isVideo = type === 'CONTENT' && typeof videoUrl === 'string';
    const isGroup = type === 'GROUP';
    const hasMedia = Boolean(thumbnailUrl || firstImage);

    // Helpers for safe rendering
    const safeTitle = post.title || '제목 없음';
    const safeContent = post.content || '';
    const safeDate = post.date || '';
    const safeLikeCount = post.likeCount || 0;
    const safeCommentCount = post.commentCount || 0;
    const safeReadCount = post.readCount || 0;

    return (
        <>
            <Card className="mb-3 border-none shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer bg-white relative group">
                <CardContent className="p-4">
                    {/* Header / Meta - NOT in Link to allow button interaction */}
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

                        <div className="flex items-center gap-2 text-xs text-[#999]">
                            <span>by {safeAuthor}</span>
                            {isAdmin && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // e.preventDefault(); // No longer needed as we aren't in a link
                                            }}
                                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full transition-colors z-10 relative"
                                            title="관리자 삭제"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>게시물 삭제</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                정말 이 게시물을 삭제하시겠습니까?<br />
                                                관리자 권한으로 삭제 시 복구할 수 없습니다.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter onClick={(e) => e.stopPropagation()}>
                                            <AlertDialogCancel onClick={(e) => {
                                                e.stopPropagation();
                                            }}>취소</AlertDialogCancel>
                                            <AlertDialogAction onClick={(e) => {
                                                e.stopPropagation();
                                                executeDelete();
                                            }} className="bg-red-600 hover:bg-red-700">
                                                삭제
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>
                    </div>

                    {/* Content Wrapped in Link */}
                    <Link href={`/community/${post.id}`}>
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
                                        unoptimized
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
                    </Link>
                </CardContent>
            </Card>
        </>
    );
}
