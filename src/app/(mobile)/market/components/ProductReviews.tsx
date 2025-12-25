'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, Trash2, ImageIcon } from 'lucide-react';
import { marketService } from '@/services/marketService';
import { Review } from '@/types/market';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from 'sonner';

interface ProductReviewsProps {
    productId: string;
}

export function ProductReviews({ productId }: ProductReviewsProps) {
    const supabase = createClient();
    const [user, setUser] = useState<any>(null);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isWriting, setIsWriting] = useState(false);

    // Write Form State
    const [rating, setRating] = useState(5);
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Optimized loading function
    const loadReviews = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await marketService.getReviews(productId);
            setReviews(data);
        } catch (error) {
            console.error('Failed to load reviews:', error);
        } finally {
            setIsLoading(false);
        }
    }, [productId]);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        checkUser();
        loadReviews();
    }, [productId, loadReviews]);

    const handleSubmit = async () => {
        if (content.trim().length < 10) {
            toast.error('내용을 10자 이상 입력해주세요.');
            return;
        }

        setIsSubmitting(true);
        try {
            await marketService.createReview({
                product_id: productId,
                rating,
                content: content.trim(),
                images: [] // TODO: Image upload later
            });
            toast.success('리뷰가 등록되었습니다!');
            setIsWriting(false);
            setContent('');
            setRating(5);
            loadReviews(); // Refresh
        } catch (error: any) {
            console.error('Failed to submit review:', error);
            if (error?.code === '23505') { // Postgres duplicate key code
                toast.error('이미 이 상품에 리뷰를 작성하셨습니다.');
            } else {
                toast.error('리뷰 등록에 실패했습니다. 다시 시도해주세요.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = (e: React.MouseEvent, reviewId: string) => {
        e.stopPropagation();

        toast('정말 리뷰를 삭제하시겠습니까?', {
            description: '삭제된 리뷰는 복구할 수 없습니다.',
            action: {
                label: '삭제',
                onClick: async () => {
                    try {
                        await marketService.deleteReview(reviewId);
                        toast.success('리뷰가 삭제되었습니다.');
                        setReviews(prev => prev.filter(r => r.id !== reviewId));
                    } catch (error) {
                        console.error('Failed to delete review:', error);
                        toast.error('삭제 실패: 권한이 없거나 오류가 발생했습니다.');
                    }
                }
            },
            cancel: {
                label: '취소',
                onClick: () => { }
            },
        });
    };

    function getRatingText(rating: number) {
        if (rating === 5) return "최고예요! 👍";
        if (rating === 4) return "좋아요 😀";
        if (rating === 3) return "보통이에요 🙂";
        if (rating === 2) return "아쉬워요 🙁";
        return "별로예요 😫";
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-[#224732]">구매 후기 ({reviews.length})</h3>
                    <p className="text-sm text-gray-500">실제 구매하신 분들의 생생한 후기입니다.</p>
                </div>
                {user && (
                    <Dialog open={isWriting} onOpenChange={setIsWriting}>
                        <DialogTrigger asChild>
                            <Button className="bg-[#224732] hover:bg-[#1a3826] text-white">
                                리뷰 쓰기
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>소중한 후기를 남겨주세요</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                {/* Rating Stars */}
                                <div className="flex justify-center space-x-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            onClick={() => setRating(star)}
                                            className="focus:outline-none transition-transform hover:scale-110"
                                        >
                                            <Star
                                                className={`w-8 h-8 ${star <= rating
                                                    ? 'fill-[#C3A675] text-[#C3A675]'
                                                    : 'text-gray-300'
                                                    }`}
                                            />
                                        </button>
                                    ))}
                                </div>
                                <div className="text-center text-sm font-medium text-[#C3A675]">
                                    {getRatingText(rating)}
                                </div>

                                <Textarea
                                    placeholder="상품에 대한 솔직한 이야기를 들려주세요. (최소 10자 이상)"
                                    className="min-h-[120px] resize-none focus-visible:ring-[#224732]"
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                />

                                <div className="flex justify-between items-center text-xs text-gray-400 px-1">
                                    <span>{content.length} / 10자 이상</span>
                                    <span>최대 500자</span>
                                </div>

                                <div className="flex gap-2">
                                    {/* Placeholder for Image Upload Button */}
                                    <Button variant="outline" size="sm" type="button" className="text-gray-500" disabled>
                                        <ImageIcon className="w-4 h-4 mr-2" />
                                        사진 추가 (준비중)
                                    </Button>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    className="w-full bg-[#224732] hover:bg-[#1a3826]"
                                    onClick={handleSubmit}
                                    disabled={isSubmitting || content.trim().length < 10}
                                >
                                    {isSubmitting ? '저장 중...' : '등록 완료'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* List */}
            <div className="space-y-4">
                {isLoading ? (
                    <div className="text-center py-10 text-gray-400">후기를 불러오고 있습니다...</div>
                ) : reviews.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <p className="text-gray-500 mb-2">아직 작성된 후기가 없어요.</p>
                        <p className="text-sm text-gray-400">첫 번째 후기의 주인공이 되어보세요!</p>
                    </div>
                ) : (
                    reviews.map((review) => (
                        <div key={review.id} className="border-b border-gray-100 pb-6 last:border-0">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="flex">
                                        {[...Array(5)].map((_, i) => (
                                            <Star
                                                key={i}
                                                className={`w-3.5 h-3.5 ${i < review.rating ? 'fill-[#C3A675] text-[#C3A675]' : 'text-gray-200'}`}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-xs text-gray-400">
                                        {formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: ko })}
                                    </span>
                                </div>
                                {user?.id === review.user_id && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-gray-400 hover:text-red-500"
                                        onClick={(e) => handleDelete(e, review.id)}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                )}
                            </div>
                            <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                                {review.content}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
