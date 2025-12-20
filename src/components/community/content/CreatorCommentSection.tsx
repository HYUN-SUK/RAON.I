"use client";

import { useState, useEffect } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { creatorService } from '@/services/creatorService';
import { CreatorComment } from '@/types/creator';

interface CreatorCommentSectionProps {
    contentId: string;
    onCommentChange?: (count: number) => void;
}

export function CreatorCommentSection({ contentId, onCommentChange }: CreatorCommentSectionProps) {
    const [comments, setComments] = useState<CreatorComment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingList, setLoadingList] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Initial Load
    useEffect(() => {
        fetchComments();
    }, [contentId]);

    const fetchComments = async () => {
        try {
            setLoadingList(true);
            const data = await creatorService.getComments(contentId);
            setComments(data);
            onCommentChange?.(data.length);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingList(false);
        }
    };

    const handleSubmit = async () => {
        if (!newComment.trim() || isLoading) return;

        setIsLoading(true);
        try {
            const created = await creatorService.createComment(contentId, newComment);
            setComments(prev => [created, ...prev]);
            onCommentChange?.(comments.length + 1);
            setNewComment('');
            setErrorMsg(null);
        } catch (error: any) {
            console.error(error);
            setErrorMsg(error.message || '댓글 작성 실패');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (commentId: string) => {
        if (!confirm('댓글을 삭제하시겠습니까?')) return;
        try {
            await creatorService.deleteComment(commentId, contentId);
            setComments(prev => prev.filter(c => c.id !== commentId));
            onCommentChange?.(Math.max(0, comments.length - 1));
        } catch (error) {
            console.error(error);
            alert('삭제 실패');
        }
    };

    if (loadingList) {
        return <div className="py-10 text-center text-gray-400">댓글을 불러오는 중...</div>;
    }

    return (
        <div className="mt-8 pt-6 border-t border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                댓글 <span className="text-sm font-normal text-gray-400">{comments.length}</span>
            </h3>

            {/* Input */}
            <div className="flex gap-3 mb-8">
                <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">나</AvatarFallback>
                </Avatar>
                <div className="flex-1 relative">
                    <Textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="따뜻한 응원이나 감상을 남겨주세요..."
                        className="min-h-[80px] bg-gray-50 border-gray-200 resize-none pr-12 text-sm focus:bg-white transition-colors"
                    />
                    <Button
                        size="icon"
                        variant="ghost"
                        className="absolute bottom-1 right-1 h-8 w-8 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                        onClick={handleSubmit}
                        disabled={!newComment.trim() || isLoading}
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </div>
            {errorMsg && <p className="text-red-500 text-sm mb-4 px-10">{errorMsg}</p>}

            {/* List */}
            <div className="space-y-6">
                {comments.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm bg-gray-50/50 rounded-xl">
                        첫 번째 댓글의 주인공이 되어보세요! 🌿
                    </div>
                ) : (
                    comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3 group">
                            <Avatar className="w-8 h-8 mt-1">
                                <AvatarFallback className="text-xs text-gray-500 bg-gray-100">
                                    {comment.user_email?.slice(0, 2).toUpperCase() || 'U'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm text-gray-900">
                                            {comment.user_email ? comment.user_email.split('@')[0] : '알 수 없음'}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ko })}
                                        </span>
                                    </div>

                                    {/* 본인 댓글인 경우 삭제 버튼 노출 (서비스에서 isMine 플래그 처리 필요) */}
                                    {comment.is_mine && (
                                        <button
                                            onClick={() => handleDelete(comment.id)}
                                            className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                    {comment.content}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
