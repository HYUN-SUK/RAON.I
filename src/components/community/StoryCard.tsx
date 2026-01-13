'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, MessageCircle, Eye, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { communityService } from '@/services/communityService';
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function StoryCard({ post }: { post: any }) {
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
            window.location.reload();
        } catch (error: any) {
            console.error(error);
            alert('삭제 실패: ' + error.message);
        }
    };

    // Ultimate Safety Extraction
    const safeTitle = typeof post.title === 'string' ? post.title : 'Untitled';
    const safeDate = typeof post.date === 'string' ? post.date : 'Unknown Date';

    // Handle potential object in author
    let safeAuthor = 'Anonymous';
    if (typeof post.author === 'string') safeAuthor = post.author;
    else if (post.author && typeof post.author === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        safeAuthor = (post.author as any).name || (post.author as any).nickname || 'Anonymous';
    }

    // Images
    const rawImages = Array.isArray(post.images) ? post.images : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const safeImages = rawImages.filter((img: any) => typeof img === 'string');
    const firstImage = safeImages.length > 0 ? safeImages[0] : null;
    const thumbnail = typeof post.thumbnailUrl === 'string' ? post.thumbnailUrl : firstImage;

    return (
        <Card className="mb-4 overflow-hidden border-none shadow-sm cursor-pointer active:opacity-95 transition-opacity">
            <CardContent className="p-0">
                <Link href={`/community/${post.id}`}>
                    {/* Image Area - 이미지가 있을 때만 표시 */}
                    {thumbnail && (
                        <div className="relative w-full aspect-video bg-gray-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={thumbnail}
                                alt={safeTitle}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}
                </Link>

                {/* Content Area */}
                <div className="p-4 bg-white">
                    <Link href={`/community/${post.id}`}>
                        <h3 className="font-bold text-gray-900 mb-2 line-clamp-1">{safeTitle}</h3>
                    </Link>

                    <div className="flex justify-between items-center text-xs text-gray-500">
                        <div className="flex items-center gap-2">
                            <span>{safeAuthor}</span>
                            <span>•</span>
                            <span>{safeDate}</span>
                        </div>

                        {/* Admin Delete - OUTSIDE Link */}
                        {isAdmin && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // e.preventDefault();
                                        }}
                                        className="p-1 px-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full transition-colors z-10 relative flex items-center"
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

                    {/* Stats */}
                    <div className="flex items-center gap-3 mt-2">
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
            </CardContent>
        </Card>
    );
}
