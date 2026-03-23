'use client';

import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toggleHeart, getHeartStatus } from '@/actions/campground';
import { toast } from 'sonner';

interface CampgroundHeartProps {
    campgroundId: string;
    initialIsHearted?: boolean;
    size?: number;
    className?: string;
    onToggle?: (isHearted: boolean) => void;
}

/**
 * Campground Heart (찜) Toggle Component
 * - 가시성 높은 하트 아이콘
 * - 토글 시 즉각적인 UI 반영 (Optimistic UI)
 * - 락앤팝 마이크로 애니메이션 적용
 */
export function CampgroundHeart({
    campgroundId,
    initialIsHearted = false,
    size = 24,
    className,
    onToggle
}: CampgroundHeartProps) {
    const [isHearted, setIsHearted] = useState(initialIsHearted);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Initial Status Check if not provided
    useEffect(() => {
        if (initialIsHearted === undefined) {
             getHeartStatus(campgroundId).then(status => {
                 setIsHearted(status);
                 setIsLoading(false);
             });
        } else {
            setIsLoading(false);
        }
    }, [campgroundId, initialIsHearted]);

    const handleToggle = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isLoading) return;

        // 1. Optimistic UI Update
        const nextState = !isHearted;
        setIsHearted(nextState);
        setIsAnimating(true);
        
        // Reset animation state after a cycle
        setTimeout(() => setIsAnimating(false), 450);

        // 2. Server Action
        const result = await toggleHeart(campgroundId);
        
        if (!result.success) {
            // Rollback on failure
            setIsHearted(!nextState);
            toast.error(result.error === 'Unauthorized' ? '로그인이 필요한 서비스입니다' : '처리에 실패했습니다');
            return;
        }

        // 3. Callback
        if (onToggle) onToggle(nextState);
        
        if (nextState) {
            toast.success('찜 목록에 추가되었습니다', {
                icon: '❤️',
                duration: 1500
            });
        }
    };

    if (isLoading) {
        return <div className={cn("w-6 h-6 bg-stone-100 rounded-full animate-pulse", className)} />;
    }

    return (
        <button
            onClick={handleToggle}
            className={cn(
                "relative flex items-center justify-center p-2 rounded-full transition-all duration-300",
                "hover:bg-white/20 active:scale-90",
                className
            )}
            aria-label={isHearted ? "Remove from favorites" : "Add to favorites"}
        >
            <Heart
                size={size}
                className={cn(
                    "transition-all duration-300 transform",
                    isHearted ? "fill-red-500 text-red-500 scale-110" : "text-white/80 scale-100",
                    isAnimating && "animate-[heart-pop_0.45s_ease-out]"
                )}
            />
            
            {/* Splash Effect on Active */}
            {isHearted && isAnimating && (
                <div className="absolute inset-0 rounded-full bg-red-400/20 animate-ping opacity-0" />
            )}

            <style jsx global>{`
                @keyframes heart-pop {
                    0% { transform: scale(1); }
                    15% { transform: scale(1.3); }
                    30% { transform: scale(0.95); }
                    45% { transform: scale(1.15); }
                    60% { transform: scale(1); }
                }
            `}</style>
        </button>
    );
}

export default CampgroundHeart;
