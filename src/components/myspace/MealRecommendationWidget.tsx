'use client';

import { Utensils, RotateCw } from 'lucide-react';
import { MealRecommendation } from '@/lib/meal-recommendation';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import RecipeDetailSheet from '@/components/common/RecipeDetailSheet';

interface MealRecommendationWidgetProps {
    recommendations: MealRecommendation[];
    className?: string;
    initialRecipeId?: string | null;
    onRefresh?: () => void;
    isLoading?: boolean;
    rationale?: string;
}

export default function MealRecommendationWidget({
    recommendations,
    className,
    initialRecipeId,
    onRefresh,
    isLoading,
    rationale
}: MealRecommendationWidgetProps) {
    const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

    useEffect(() => {
        if (initialRecipeId) {
            setSelectedRecipeId(initialRecipeId);
        }
    }, [initialRecipeId]);

    if (!recommendations || recommendations.length === 0) return null;

    return (
        <div className={cn("space-y-3", className)}>
            <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-lg font-bold text-[#1C4526]">
                    <Utensils className="w-5 h-5" />
                    추천 캠핑 요리
                </h3>
                {onRefresh && (
                    <button
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="flex items-center gap-1 text-xs text-stone-500 hover:text-[#1C4526] transition-colors disabled:opacity-50"
                    >
                        <RotateCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                        다른 메뉴
                    </button>
                )}
            </div>

            {rationale && (
                <div className="bg-[#224732]/5 p-3 rounded-lg text-sm text-[#224732] leading-relaxed break-keep">
                    💡 {rationale}
                </div>
            )}

            <div className="grid gap-3">
                {recommendations.map((meal) => (
                    <div
                        key={meal.id}
                        onClick={() => setSelectedRecipeId(meal.id)}
                        className="bg-white rounded-xl p-4 shadow-sm border border-stone-100 flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer active:scale-[0.99]"
                    >
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-gray-800">{meal.title}</h4>
                            </div>
                            <p className="text-sm text-gray-500 line-clamp-1 mb-2">
                                {meal.description}
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {meal.tags && Array.isArray(meal.tags) && meal.tags.map((tag: string, idx: number) => (
                                    <span key={idx} className="text-xs text-stone-500 bg-stone-50 px-1.5 py-0.5 rounded">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <RecipeDetailSheet
                isOpen={!!selectedRecipeId}
                onClose={() => setSelectedRecipeId(null)}
                recipeId={selectedRecipeId || undefined}
            />
        </div>
    );
}
