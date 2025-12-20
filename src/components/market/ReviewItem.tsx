import React from 'react';
import { Review } from '@/types/market';
import { Star, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ReviewItemProps {
    review: Review;
}

export const ReviewItem: React.FC<ReviewItemProps> = ({ review }) => {
    return (
        <div className="py-4 border-b last:border-0 border-[var(--color-surface-2)]">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-[var(--color-text-2)]">
                        <User size={16} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-[var(--color-text-1)]">
                            캠퍼{review.user_id.slice(0, 4)}
                        </span>
                        <span className="text-xs text-[var(--color-text-2)]">
                            {formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: ko })}
                        </span>
                    </div>
                </div>
                <div className="flex text-[var(--color-accent-1)]">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                            key={i}
                            size={14}
                            className={i < review.rating ? "fill-current" : "text-gray-300 stroke-gray-300"}
                        />
                    ))}
                </div>
            </div>

            <p className="text-sm text-[var(--color-text-1)] leading-relaxed whitespace-pre-wrap">
                {review.content}
            </p>

            {review.images && review.images.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                    {review.images.map((img, idx) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            key={idx}
                            src={img}
                            alt="review"
                            className="w-20 h-20 object-cover rounded-lg bg-[var(--color-surface-2)]"
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
