'use client';

import React, { useState, useTransition } from 'react';
import { createGroupPostAction, GroupPost } from '@/actions/group-post';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Image as ImageIcon, Send, MoreHorizontal, MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LikeButton from './LikeButton';

interface Props {
    groupId: string;
    posts: GroupPost[];
    currentUserId?: string;
    isMember: boolean;
}

export default function GroupFeed({ groupId, posts, currentUserId, isMember }: Props) {
    const [content, setContent] = useState('');
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleSubmit = async () => {
        if (!content.trim()) return;

        startTransition(async () => {
            const result = await createGroupPostAction(groupId, content, []); // Images unimplemented for now
            if (result.success) {
                setContent('');
                // revalidatePath handles refresh
            } else {
                alert('작성 실패: ' + result.error);
            }
        });
    };

    return (
        <div className="space-y-6">
            {/* Write Area (Only for members) */}
            {isMember && (
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex gap-3">
                        <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-[#1C4526]/5 text-[#1C4526]">나</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-3">
                            <Textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="멤버들과 이야기를 나눠보세요..."
                                className="min-h-[80px] bg-gray-50 border-0 focus-visible:ring-1 focus-visible:ring-[#1C4526]/20 resize-none rounded-xl text-sm"
                            />
                            <div className="flex justify-between items-center">
                                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-[#1C4526]" disabled>
                                    <ImageIcon className="w-4 h-4 mr-2" />
                                    사진
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={!content.trim() || isPending}
                                    size="sm"
                                    className="bg-[#1C4526] hover:bg-[#15341d] text-white rounded-lg px-4"
                                >
                                    {isPending ? '등록 중...' : <><Send className="w-3.5 h-3.5 mr-2" /> 등록</>}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Post List */}
            <div className="space-y-4">
                {posts.length === 0 ? (
                    <div className="py-12 text-center text-gray-400 bg-white/50 rounded-2xl border border-dashed border-gray-200">
                        {isMember ? '첫 번째 글을 남겨보세요!' : '아직 게시글이 없습니다.'}
                    </div>
                ) : (
                    posts.map((post) => (
                        <div key={post.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative">
                            {/* Card Header & Content - Clickable to Detail */}
                            <Link href={`/community/${post.id}`} className="block">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-9 w-9 border border-gray-100">
                                            <AvatarFallback className="bg-[#1C4526]/5 text-[#1C4526]">
                                                {post.author_name[0]}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-semibold text-sm text-[#1A1A1A]">{post.author_name}</p>
                                            <p className="text-xs text-gray-400">
                                                {new Date(post.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400">
                                        <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                </div>

                                <div className="text-[#4D4D4D] text-sm whitespace-pre-wrap leading-relaxed mb-4">
                                    {post.content}
                                </div>
                            </Link>

                            {/* Images would go here */}

                            {/* Interactions */}
                            <div className="flex items-center gap-4 pt-3 border-t border-gray-50">
                                <LikeButton
                                    postId={post.id}
                                    likeCount={post.like_count}
                                    initialIsLiked={post.is_liked}
                                    className="text-xs text-gray-500"
                                />
                                <Link
                                    href={`/community/${post.id}`}
                                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#1C4526] transition-colors"
                                >
                                    <MessageCircle className="w-4 h-4" />
                                    {post.comment_count}
                                </Link>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
