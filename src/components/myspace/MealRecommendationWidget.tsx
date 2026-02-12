'use client';

import { Utensils } from 'lucide-react';
import { MealRecommend } from '@/lib/meal-recommendation';
import { cn } from '@/lib/utils';

interface MealRecommendationWidgetProps {
    recommendations: MealRecommend[];
    className?: string;
    initialRecipeId?: string | null;
}

import { useState, useEffect } from 'react';
import RecipeDetailSheet from '@/components/common/RecipeDetailSheet';

export default function MealRecommendationWidget({ recommendations, className, initialRecipeId }: MealRecommendationWidgetProps) {
    const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

    useEffect(() => {
        if (initialRecipeId) {
            setSelectedRecipeId(initialRecipeId);
        }
    }, [initialRecipeId]);

    if (!recommendations || recommendations.length === 0) return null;

    return (
        <div className={cn("space-y-3", className)}>
            <h3 className="flex items-center gap-2 text-lg font-bold text-[#1C4526]">
                <Utensils className="w-5 h-5" />
                추천 캠핑 요리
            </h3>

            <div className="grid gap-3">
                {recommendations.map((meal) => (
                    <div
                        key={meal.id}
                        onClick={() => setSelectedRecipeId(meal.id)}
                        className="bg-white rounded-xl p-4 shadow-sm border border-stone-100 flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer active:scale-[0.99]"
                    >
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-gray-800">{meal.name}</h4>
                                <span className={cn(
                                    "px-2 py-1 rounded-full text-xs font-medium",
                                    // Map number to colors if needed, or just use a generic one
                                    "bg-yellow-100 text-yellow-700"
                                )}>
                                    {'⭐'.repeat(meal.difficulty || 1)}
                                </span>
                            </div>
                            <p className="text-sm text-gray-500 line-clamp-1 mb-2">
                                {meal.description}
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {meal.tags && Array.isArray(meal.tags) && meal.tags.map((tag, idx) => (
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
