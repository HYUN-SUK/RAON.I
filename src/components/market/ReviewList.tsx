import React, { useEffect } from 'react';
import { useMarketStore } from '@/store/useMarketStore';
import { ReviewItem } from './ReviewItem';
import { ReviewWriteSheet } from './ReviewWriteSheet';
import { Button } from '@/components/ui/button';
import { PenLine } from 'lucide-react';

interface ReviewListProps {
    productId: string;
}

export const ReviewList: React.FC<ReviewListProps> = ({ productId }) => {
    const { reviews, fetchReviews, isLoading } = useMarketStore();
    const productReviews = reviews[productId] || [];

    useEffect(() => {
        fetchReviews(productId);
    }, [productId, fetchReviews]);

    return (
        <div className="flex flex-col relative min-h-[300px]">
            {/* Header / Stats */}
            <div className="flex items-center justify-between py-4 px-1">
                <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-[var(--color-text-1)]">
                        후기 {productReviews.length}
                    </span>
                    {productReviews.length > 0 && (
                        <span className="text-sm font-medium text-[var(--color-primary)]">
                            ⭐ {(productReviews.reduce((acc, r) => acc + r.rating, 0) / productReviews.length).toFixed(1)}
                        </span>
                    )}
                </div>

                <ReviewWriteSheet productId={productId}>
                    <Button variant="ghost" size="sm" className="text-[var(--color-brand-2)] font-medium gap-1">
                        <PenLine size={16} />
                        쓰기
                    </Button>
                </ReviewWriteSheet>
            </div>

            {/* List */}
            <div className="flex flex-col">
                {isLoading && productReviews.length === 0 ? (
                    <div className="py-12 text-center text-[var(--color-text-2)]">loading...</div>
                ) : productReviews.length > 0 ? (
                    productReviews.map((review) => (
                        <ReviewItem key={review.id} review={review} />
                    ))
                ) : (
                    <div className="py-20 flex flex-col items-center justify-center text-[var(--color-text-3)] gap-2">
                        <p>아직 작성된 후기가 없어요.</p>
                        <p className="text-sm">가장 먼저 후기를 남겨보세요!</p>
                        <div className="mt-4">
                            <ReviewWriteSheet productId={productId} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
