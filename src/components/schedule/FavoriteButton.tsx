'use client';

import { useState, useEffect } from 'react';
import { Heart, Loader2 } from 'lucide-react';
import { toggleFavorite, isFavorite } from '@/actions/schedule';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface FavoriteButtonProps {
    campgroundId: string;
    initialFavorite?: boolean;
    onToggle?: (isFavorite: boolean) => void;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'icon' | 'button';
    className?: string;
}

export default function FavoriteButton({
    campgroundId,
    initialFavorite,
    onToggle,
    size = 'md',
    variant = 'icon',
    className,
}: FavoriteButtonProps) {
    const [isFav, setIsFav] = useState(initialFavorite ?? false);
    const [isLoading, setIsLoading] = useState(false);
    const [isChecking, setIsChecking] = useState(initialFavorite === undefined);

    // 초기 상태 확인 (initialFavorite이 없을 때)
    useEffect(() => {
        if (initialFavorite === undefined) {
            setIsChecking(true);
            isFavorite(campgroundId).then((result) => {
                setIsFav(result);
                setIsChecking(false);
            });
        }
    }, [campgroundId, initialFavorite]);

    const handleToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        setIsLoading(true);

        try {
            const result = await toggleFavorite(campgroundId);

            if (result.success && result.isFavorite !== undefined) {
                setIsFav(result.isFavorite);
                onToggle?.(result.isFavorite);

                if (result.isFavorite) {
                    toast.success('찜 목록에 추가했어요 ❤️');
                } else {
                    toast('찜 목록에서 제외했어요');
                }
            } else {
                toast.error(result.error || '처리에 실패했어요');
            }
        } catch (error) {
            console.error('Toggle favorite error:', error);
            toast.error('오류가 발생했어요');
        } finally {
            setIsLoading(false);
        }
    };

    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
        lg: 'w-6 h-6',
    };

    const buttonSizeClasses = {
        sm: 'p-1.5',
        md: 'p-2',
        lg: 'p-2.5',
    };

    if (isChecking) {
        return (
            <div className={cn("flex items-center justify-center", buttonSizeClasses[size], className)}>
                <Loader2 className={cn(sizeClasses[size], "text-gray-300 animate-spin")} />
            </div>
        );
    }

    if (variant === 'icon') {
        return (
            <button
                onClick={handleToggle}
                disabled={isLoading}
                className={cn(
                    "flex items-center justify-center rounded-full transition-all",
                    buttonSizeClasses[size],
                    "hover:bg-gray-100 active:scale-95",
                    isLoading && "opacity-50",
                    className
                )}
                aria-label={isFav ? '찜 해제' : '찜하기'}
            >
                {isLoading ? (
                    <Loader2 className={cn(sizeClasses[size], "text-gray-400 animate-spin")} />
                ) : (
                    <Heart
                        className={cn(
                            sizeClasses[size],
                            "transition-colors",
                            isFav
                                ? "fill-red-500 text-red-500"
                                : "fill-none text-gray-400 hover:text-red-400"
                        )}
                    />
                )}
            </button>
        );
    }

    // button variant
    return (
        <button
            onClick={handleToggle}
            disabled={isLoading}
            className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all",
                "border text-sm font-medium active:scale-95",
                isFav
                    ? "bg-red-50 border-red-200 text-red-600"
                    : "bg-white border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-500",
                isLoading && "opacity-50",
                className
            )}
        >
            {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
                <Heart className={cn("w-4 h-4", isFav && "fill-current")} />
            )}
            <span>{isFav ? '찜함' : '찜하기'}</span>
        </button>
    );
}
