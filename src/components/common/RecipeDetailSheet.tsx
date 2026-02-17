'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import {
    Clock, Flame, Users, ChevronDown, Check, Search, X, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { searchRecipes, getRecipeById, RecipeSearchResult } from '@/actions/recommendation'; // Import actions

// Reuse HomeDetailData or define strict RecipeData
export interface RecipeData {
    id: string;
    title: string;
    description?: string;
    category: string;
    image_url?: string;
    ingredients?: string[] | { name: string; amount: string }[];
    steps?: string[];
    tips?: string;
    time_required?: number;
    difficulty?: number;
    servings?: string;
    calories?: number;
    tags?: string[];
}

interface RecipeDetailSheetProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: RecipeData | null;
    recipeId?: string; // If provided, fetches data
}

export default function RecipeDetailSheet({ isOpen, onClose, initialData, recipeId }: RecipeDetailSheetProps) {
    const router = useRouter();
    const [data, setData] = useState<RecipeData | null>(initialData || null);
    const [loading, setLoading] = useState(false);
    const [checkedIngredients, setCheckedIngredients] = useState<number[]>([]);

    // Search State
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<RecipeSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Fetch data if recipeId changes or initialData provided
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setData(initialData);
            } else if (recipeId) {
                fetchRecipe(recipeId);
            }
        } else {
            // Reset state on close
            setIsSearchOpen(false);
            setSearchQuery('');
            setSearchResults([]);
            setCheckedIngredients([]);
        }
    }, [isOpen, recipeId, initialData]);

    const fetchRecipe = async (id: string) => {
        setLoading(true);
        try {
            const recipe = await getRecipeById(id);
            if (recipe) {
                // Map DB response to RecipeData if needed
                setData({
                    ...recipe,
                    steps: recipe.process_steps || recipe.steps,
                    // Ensure compatibility mapping if DB fields differ
                });
            } else {
                toast.error("레시피를 찾을 수 없습니다.");
                onClose();
            }
        } catch (error) {
            console.error(error);
            toast.error("레시피 로딩 실패");
        } finally {
            setLoading(false);
        }
    };

    // Search Handler
    const handleSearch = useCallback(async (query: string) => {
        setSearchQuery(query);
        if (query.length < 1) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const results = await searchRecipes(query);
            setSearchResults(results);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSearching(false);
        }
    }, []);

    const handleSelectRecipe = async (id: string) => {
        await fetchRecipe(id);
        setIsSearchOpen(false);
        setSearchQuery('');
    };

    const toggleIngredient = (index: number) => {
        setCheckedIngredients(prev =>
            prev.includes(index)
                ? prev.filter(i => i !== index)
                : [...prev, index]
        );
    };

    if (!data && !loading && !isSearchOpen) return null;

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="bottom" className="rounded-t-[32px] p-0 border-none h-[92vh] max-h-[92vh] overflow-hidden bg-white dark:bg-zinc-900 flex flex-col">

                {/* 1. Header (Sticky) */}
                <div className="flex items-center justify-between p-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md z-50 border-b border-gray-100 dark:border-zinc-800">
                    {isSearchOpen ? (
                        <div className="flex-1 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                            <Search className="w-5 h-5 text-gray-400" />
                            <Input
                                autoFocus
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                                placeholder="레시피 검색..."
                                className="border-none bg-transparent focus-visible:ring-0 px-0 text-base"
                            />
                            <button onClick={() => setIsSearchOpen(false)} className="p-2">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={() => setIsSearchOpen(true)}
                                className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                                <Search className="w-5 h-5 text-gray-600" />
                            </button>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                            >
                                <ChevronDown size={20} className="text-gray-600" />
                            </button>
                        </>
                    )}
                </div>

                {/* 2. Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-6 pb-20">
                    {/* Search Results */}
                    {isSearchOpen && (
                        <div className="py-4 space-y-2 animate-in fade-in">
                            {isSearching ? (
                                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>
                            ) : searchResults.length > 0 ? (
                                searchResults.map(item => (
                                    <div
                                        key={item.id}
                                        onClick={() => handleSelectRecipe(item.id)}
                                        className="flex gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                                    >
                                        {item.image_url && (
                                            <div className="w-16 h-16 rounded-lg bg-gray-200 bg-cover bg-center shrink-0" style={{ backgroundImage: `url(${item.image_url})` }} />
                                        )}
                                        <div>
                                            <h4 className="font-bold text-gray-900">{item.title}</h4>
                                            <p className="text-sm text-gray-500 line-clamp-2">{item.description}</p>
                                        </div>
                                    </div>
                                ))
                            ) : searchQuery && (
                                <div className="text-center py-10 text-gray-400">검색 결과가 없습니다.</div>
                            )}
                        </div>
                    )}

                    {/* Recipe Data */}
                    {!isSearchOpen && data && (
                        <div className="pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* ... Content similar to HomeDetailSheet ... */}
                            <SheetHeader className="text-left space-y-2 mb-6">
                                <Badge variant="outline" className="w-fit text-brand-1 border-brand-1">오늘의 추천</Badge>
                                <SheetTitle className="text-2xl font-bold text-gray-900 leading-tight">
                                    {data.title}
                                </SheetTitle>
                                <SheetDescription className="text-base text-gray-600 break-keep whitespace-pre-line">
                                    {data.description}
                                </SheetDescription>
                            </SheetHeader>

                            {/* Metadata Info Bar */}
                            {(data.time_required || data.difficulty || data.servings) && (
                                <div className="flex items-center justify-between bg-gray-50 rounded-2xl p-4 mb-8">
                                    <div className="flex flex-col items-center flex-1 border-r border-gray-200">
                                        <Clock className="w-5 h-5 text-gray-400 mb-1" />
                                        <span className="text-xs font-bold text-gray-700">{data.time_required ? `${data.time_required}분` : '-'}</span>
                                    </div>
                                    <div className="flex flex-col items-center flex-1 border-r border-gray-200">
                                        <Flame className="w-5 h-5 text-gray-400 mb-1" />
                                        <span className="text-xs font-bold text-gray-700">{data.difficulty ? '⭐'.repeat(data.difficulty) : '-'}</span>
                                    </div>
                                    <div className="flex flex-col items-center flex-1">
                                        <Users className="w-5 h-5 text-gray-400 mb-1" />
                                        <span className="text-xs font-bold text-gray-700">{data.servings || '-'}인분</span>
                                    </div>
                                </div>
                            )}

                            {/* 5. Ingredients */}
                            {data.ingredients && (
                                <div className="mb-8">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4">준비물</h3>
                                    <div className="grid grid-cols-1 gap-3">
                                        {Array.isArray(data.ingredients) && data.ingredients.map((ing, i) => {
                                            const isChecked = checkedIngredients.includes(i);
                                            const name = typeof ing === 'string' ? ing : ing.name;
                                            const amount = typeof ing === 'string' ? '' : ing.amount;

                                            return (
                                                <div
                                                    key={i}
                                                    onClick={() => toggleIngredient(i)}
                                                    className={`
                                                        flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer
                                                        ${isChecked
                                                            ? 'bg-gray-50 border-gray-200 text-gray-400'
                                                            : 'bg-white border-gray-200 hover:border-[#1C4526] text-gray-800'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`
                                                            w-5 h-5 rounded-full border flex items-center justify-center transition-colors
                                                            ${isChecked ? 'bg-gray-300 border-gray-300' : 'border-gray-300'}
                                                        `}>
                                                            {isChecked && <Check size={12} className="text-white" />}
                                                        </div>
                                                        <span className={isChecked ? 'line-through' : 'font-medium'}>{name}</span>
                                                    </div>
                                                    {amount && <span className={`text-sm ${isChecked ? 'text-gray-300' : 'text-[#1C4526] font-bold'}`}>{amount}</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* 6. Steps */}
                            {data.steps && (
                                <div className="mb-8">
                                    <h3 className="text-lg font-bold text-gray-900 mb-6">조리 순서</h3>
                                    <div className="space-y-0 relative">
                                        <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-gray-100" />
                                        {data.steps.map((step, i) => (
                                            <div key={i} className="relative flex gap-4 pb-8 last:pb-0">
                                                <div className="flex-none w-8 h-8 rounded-full bg-[#1C4526] text-white text-sm font-bold flex items-center justify-center relative z-10 ring-4 ring-white">
                                                    {i + 1}
                                                </div>
                                                <div className="pt-1">
                                                    <p className="text-gray-700 leading-relaxed font-medium">{step}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 7. Tips */}
                            {data.tips && (
                                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 mb-8">
                                    <div className="flex items-start gap-3">
                                        <span className="text-xl">💡</span>
                                        <div>
                                            <h4 className="font-bold text-amber-900 text-sm mb-1">Honey Tip</h4>
                                            <p className="text-sm text-amber-800 leading-relaxed">{data.tips}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
