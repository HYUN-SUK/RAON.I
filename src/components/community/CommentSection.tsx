"use client";

import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, MoreHorizontal, Image as ImageIcon, X, Heart } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCommunityStore } from '@/store/useCommunityStore';
import { Comment, communityService, supabase } from '@/services/communityService';
import { compressImage } from '@/utils/imageUtils';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface CommentSectionProps {
    postId: string;
    onCommentChange?: (count: number) => void;
}

export default function CommentSection({ postId, onCommentChange }: CommentSectionProps) {
    const { loadComments, addComment, removeComment, toggleCommentLike } = useCommunityStore();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Image State
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleLike = async (commentId: string) => {
        // Optimistic Update
        setComments(prev => prev.map(c => {
            if (c.id === commentId) {
                const isLiked = !!c.isLiked;
                return {
                    ...c,
                    isLiked: !isLiked,
                    likesCount: (c.likesCount || 0) + (isLiked ? -1 : 1)
                };
            }
            return c;
        }));

        try {
            await toggleCommentLike(commentId);
        } catch (error) {
            // Revert on error
            console.error(error);
            // Reload comments to restore state
            loadComments(postId).then(setComments);
        }
    };


    // Initial Load
    useEffect(() => {
        loadComments(postId).then(setComments).catch(console.error);
    }, [postId, loadComments]);

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const compressed = await compressImage(file);
            setSelectedImage(compressed);

            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
            };
            reader.readAsDataURL(compressed);
        } catch (error) {
            console.error('Image compression failed', error);
            setErrorMsg('이미지 처리 중 오류가 발생했습니다.');
        }
    };

    const clearImage = () => {
        setSelectedImage(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSubmit = async () => {
        if ((!newComment.trim() && !selectedImage) || isLoading) return;

        setIsLoading(true);
        try {
            let imageUrl = undefined;
            if (selectedImage) {
                imageUrl = await communityService.uploadCommentImage(selectedImage);
            }

            const created = await addComment(postId, newComment, 'My User', imageUrl);
            setComments(prev => [...prev, created]);
            onCommentChange?.(comments.length + 1);
            setNewComment('');
            clearImage();
            setErrorMsg(null);
        } catch (error: any) {
            console.error(error);
            setErrorMsg(error.message || '댓글 작성 실패');
        } finally {
            setIsLoading(false);
        }
    };

    const [commentToDelete, setCommentToDelete] = useState<string | null>(null);

    const handleDelete = async (commentId: string) => {
        setCommentToDelete(commentId);
    };

    const confirmDelete = async () => {
        if (!commentToDelete) return;

        const commentId = commentToDelete;
        try {
            await removeComment(postId, commentId);
            setComments(prev => prev.filter(c => c.id !== commentId));
            onCommentChange?.(Math.max(0, comments.length - 1));
            // Toast removed, consistent with user request for modal only
        } catch (error: any) {
            console.error(error);
            alert(`삭제 실패: ${error.message || '알 수 없는 오류'}`);
        } finally {
            setCommentToDelete(null);
        }
    };

    return (
        <div className="mt-8 pt-6 border-t border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                댓글 <span className="text-sm font-normal text-gray-400">{comments.length}</span>
            </h3>

            {/* Input */}
            <div className="flex gap-3 mb-8">
                <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">ME</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                    <div className="relative">
                        <Textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="따뜻한 댓글을 남겨주세요..."
                            className="min-h-[80px] bg-gray-50 border-gray-200 resize-none pr-12 text-sm pb-10" // Extra padding bottom for buttons
                        />

                        {/* Toolbar */}
                        <div className="absolute bottom-2 left-2 flex gap-2">
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleImageSelect}
                            />
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <ImageIcon className="w-4 h-4" />
                            </Button>
                        </div>

                        <Button
                            size="icon"
                            variant="ghost"
                            className="absolute bottom-2 right-2 h-8 w-8 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                            onClick={handleSubmit}
                            disabled={(!newComment.trim() && !selectedImage) || isLoading}
                        >
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Image Preview */}
                    {previewUrl && (
                        <div className="relative inline-block">
                            <img src={previewUrl} alt="Preview" className="h-20 w-auto rounded-lg border border-gray-200 object-cover" />
                            <button
                                onClick={clearImage}
                                className="absolute -top-1 -right-1 bg-black/50 text-white rounded-full p-0.5 hover:bg-black/70"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}

                    {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}
                </div>
            </div>

            {/* List */}
            <div className="space-y-6">
                {comments.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                        아직 댓글이 없습니다.<br />첫 번째 댓글을 남겨보세요.
                    </div>
                ) : (
                    comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3 group">
                            <Avatar className="w-8 h-8 mt-1">
                                <AvatarFallback className="text-xs text-gray-500 bg-gray-100">
                                    {comment.author.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm text-gray-900">{comment.author}</span>
                                        <span className="text-xs text-gray-400" suppressHydrationWarning>
                                            {formatDistanceToNow(new Date(comment.date), { addSuffix: true, locale: ko })}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => handleLike(comment.id)}
                                            className={`flex items-center gap-1 text-xs font-medium transition-colors ${comment.isLiked
                                                ? 'text-red-500'
                                                : 'text-gray-400 hover:text-red-500'
                                                }`}
                                        >
                                            <Heart className={`w-3.5 h-3.5 ${comment.isLiked ? 'fill-current' : ''}`} />
                                            <span>{comment.likesCount || 0}</span>
                                        </button>
                                        {(comment.isMine || comment.isAdmin) && (
                                            <button
                                                onClick={() => handleDelete(comment.id)}
                                                className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-gray-100"
                                                title="댓글 삭제"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap space-y-2">
                                    {comment.imageUrl && (
                                        <img
                                            src={comment.imageUrl}
                                            alt="Comment attachment"
                                            className="max-w-[200px] max-h-[200px] rounded-lg border border-gray-100 object-cover"
                                            loading="lazy"
                                        />
                                    )}
                                    <p>{comment.content}</p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <Dialog open={!!commentToDelete} onOpenChange={(open) => !open && setCommentToDelete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>댓글 삭제</DialogTitle>
                        <DialogDescription>
                            정말로 삭제하시겠습니까? 삭제된 댓글은 복구할 수 없습니다.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2">
                        <Button variant="outline" onClick={() => setCommentToDelete(null)}>
                            취소
                        </Button>
                        <Button variant="destructive" onClick={confirmDelete}>
                            삭제
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
