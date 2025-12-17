"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { communityService } from '@/services/communityService';

interface LikeButtonProps {
    postId: string;
    initialIsLiked?: boolean;
    likeCount: number;
    className?: string;
    onLikeChange?: (newCount: number, isLiked: boolean) => void;
}

export default function LikeButton({
    postId,
    initialIsLiked = false,
    likeCount,
    className,
    onLikeChange
}: LikeButtonProps) {
    const [isLiked, setIsLiked] = useState(initialIsLiked);
    const [count, setCount] = useState(likeCount);
    const [isAnimating, setIsAnimating] = useState(false);

    const handleLike = async (e: React.MouseEvent) => {
        e.preventDefault(); // Prevent navigation if inside a link
        e.stopPropagation();

        if (isAnimating) return;

        setIsAnimating(true);

        // Optimistic update
        const newIsLiked = !isLiked;
        const newCount = newIsLiked ? count + 1 : Math.max(0, count - 1);

        setIsLiked(newIsLiked);
        setCount(newCount);
        onLikeChange?.(newCount, newIsLiked);

        // Call API
        try {
            await communityService.toggleLike(postId);
        } catch (error) {
            console.error('Like toggle failed', error);
            // Revert on error? For now, we keep optimistic
        }

        setTimeout(() => setIsAnimating(false), 500);
    };

    return (
        <button
            onClick={handleLike}
            className={cn(
                "flex items-center gap-1.5 transition-colors duration-200",
                isLiked ? "text-red-500" : "text-gray-500 hover:text-gray-700",
                className
            )}
        >
            <div className="relative">
                <motion.div
                    whileTap={{ scale: 0.8 }}
                    animate={isLiked && isAnimating ? { scale: [1, 1.5, 1] } : {}}
                    transition={{ duration: 0.4 }}
                >
                    <Heart
                        className={cn("w-5 h-5", isLiked && "fill-current")}
                        strokeWidth={isLiked ? 0 : 2}
                    />
                </motion.div>
            </div>

            <span className="text-sm font-medium min-w-[1ch]">
                {count}
            </span>
        </button>
    );
}
