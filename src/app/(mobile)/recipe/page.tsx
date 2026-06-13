'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase-client';
import { 
    ChevronLeft, 
    Search, 
    Utensils, 
    BookOpen, 
    Youtube, 
    Instagram, 
    Check, 
    X,
    Sparkles,
    ChefHat,
    ShoppingBag,
    Info
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Define TS Interfaces for safety
interface CategoryNode {
    id: number;
    name: string;
    parent_id: number | null;
    icon_emoji?: string;
}

interface IngredientItem {
    name: string;
    amount: string;
}

interface RecipeItem {
    id: string;
    category_id: number;
    name: string;
    thumbnail_url?: string;
    ingredients: IngredientItem[];
    travel_tips: string[];
    youtube_search_keyword?: string;
    instagram_search_keyword?: string;
    view_count: number;
}

export default function TravelRecipePage() {
    const router = useRouter();
    const supabase = createClient();

    // State
    const [categories, setCategories] = useState<CategoryNode[]>([]);
    const [recipes, setRecipes] = useState<RecipeItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Navigation state
    const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
    const [selectedChildId, setSelectedChildId] = useState<number | null>(null);

    // Bottom sheet details state
    const [selectedRecipe, setSelectedRecipe] = useState<RecipeItem | null>(null);
    const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});

    // Fetch initial categories & recipes
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setLoading(true);
                // 1. Fetch categories
                const { data: catData, error: catErr } = await supabase
                    .from('travel_recipe_categories')
                    .select('*')
                    .order('sort_order', { ascending: true });

                if (catErr) throw catErr;
                setCategories(catData || []);

                // Set initial active parent category
                const parents = (catData || []).filter(c => c.parent_id === null);
                if (parents.length > 0) {
                    setSelectedParentId(parents[0].id);
                }

                // 2. Fetch recipes
                const { data: recData, error: recErr } = await supabase
                    .from('travel_recipes')
                    .select('*')
                    .order('view_count', { ascending: false });

                if (recErr) throw recErr;
                setRecipes(recData || []);

            } catch (err: any) {
                console.error("Error loading recipes:", err);
                toast.error("레시피 데이터를 불러올 수 없습니다. 테이블 생성 여부를 확인해 주세요.");
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, []);

    // Filter parent & child categories
    const parentCategories = useMemo(() => {
        return categories.filter(c => c.parent_id === null);
    }, [categories]);

    const childCategories = useMemo(() => {
        if (selectedParentId === null) return [];
        return categories.filter(c => c.parent_id === selectedParentId);
    }, [categories, selectedParentId]);

    // Automatically select the 'All' or first child category when parent changes
    useEffect(() => {
        if (childCategories.length > 0) {
            setSelectedChildId(childCategories[0].id); // Defaults to first child (e.g., 'All' or specific tag)
        } else {
            setSelectedChildId(null);
        }
    }, [selectedParentId, childCategories]);

    // Active Category Name (for helper text)
    const activeCategoryName = useMemo(() => {
        const parent = parentCategories.find(p => p.id === selectedParentId);
        const child = childCategories.find(c => c.id === selectedChildId);
        if (!parent) return '레시피';
        return `${parent.name} ${child ? `> ${child.name}` : ''}`;
    }, [parentCategories, childCategories, selectedParentId, selectedChildId]);

    // Filtered Recipes
    const filteredRecipes = useMemo(() => {
        return recipes.filter(recipe => {
            // Category match
            let matchesCategory = true;
            if (selectedChildId !== null) {
                // If it maps to child category
                matchesCategory = recipe.category_id === selectedChildId;
            } else if (selectedParentId !== null) {
                // If parent matches (fallback)
                const childrenIds = categories.filter(c => c.parent_id === selectedParentId).map(c => c.id);
                matchesCategory = childrenIds.includes(recipe.category_id);
            }

            // Search query match
            let matchesSearch = true;
            if (searchQuery.trim() !== '') {
                const query = searchQuery.toLowerCase();
                const nameMatch = recipe.name.toLowerCase().includes(query);
                const tagMatch = recipe.travel_tips.some(t => t.toLowerCase().includes(query));
                const ingredientMatch = recipe.ingredients.some(i => i.name.toLowerCase().includes(query));
                matchesSearch = nameMatch || tagMatch || ingredientMatch;
            }

            return matchesCategory && matchesSearch;
        });
    }, [recipes, selectedParentId, selectedChildId, categories, searchQuery]);

    // Handle Open Detail Sheet
    const handleRecipeClick = (recipe: RecipeItem) => {
        setSelectedRecipe(recipe);
        setCheckedIngredients({}); // Reset checklist
        // Increment view count dynamically in background
        supabase.rpc('increment_recipe_views', { recipe_id: recipe.id }).then(({ error }) => {
            if (error) {
                // fallback if RPC doesn't exist yet
                supabase.from('travel_recipes')
                    .update({ view_count: (recipe.view_count || 0) + 1 })
                    .eq('id', recipe.id);
            }
        });
    };

    // Toggle Ingredient Checklist
    const toggleIngredient = (name: string) => {
        setCheckedIngredients(prev => ({
            ...prev,
            [name]: !prev[name]
        }));
    };

    // External Social App Link Handler
    const handleSocialSearch = (platform: 'youtube' | 'instagram', recipe: RecipeItem) => {
        const parentName = parentCategories.find(p => p.id === selectedParentId)?.name || '';
        let keyword = platform === 'youtube' ? recipe.youtube_search_keyword : recipe.instagram_search_keyword;
        
        if (!keyword) {
            if (parentName.includes('바베큐') || parentName.includes('그릴')) {
                keyword = platform === 'youtube' ? `${recipe.name} 캠핑 바베큐 레시피` : `캠핑${recipe.name.replace(/\s+/g, '')}`;
            } else if (parentName.includes('원팬') || parentName.includes('간단')) {
                keyword = platform === 'youtube' ? `${recipe.name} 펜션 간단 요리` : `펜션요리${recipe.name.replace(/\s+/g, '')}`;
            } else {
                keyword = platform === 'youtube' ? `${recipe.name} 초간단 여행 레시피` : `여행요리${recipe.name.replace(/\s+/g, '')}`;
            }
        }

        const encodedKeyword = encodeURIComponent(keyword);
        
        if (platform === 'youtube') {
            const webUrl = `https://www.youtube.com/results?search_query=${encodedKeyword}`;
            const appUrl = `youtube://results?search_query=${encodedKeyword}`;
            
            // Try to redirect to app first
            window.location.href = appUrl;
            setTimeout(() => {
                window.open(webUrl, '_blank');
            }, 800);
        } else {
            const tag = keyword.replace(/#/g, '');
            const webUrl = `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`;
            const appUrl = `instagram://tag?name=${encodeURIComponent(tag)}`;
            
            window.location.href = appUrl;
            setTimeout(() => {
                window.open(webUrl, '_blank');
            }, 800);
        }
    };

    return (
        <div className="w-full min-h-screen bg-[#F7F5EF] dark:bg-[#0f0e0c] text-stone-800 dark:text-stone-200 pb-20 font-sans">
            {/* Header */}
            <header className="sticky top-0 z-40 w-full bg-[#F7F5EF]/85 dark:bg-[#0f0e0c]/85 backdrop-blur-md border-b border-stone-200/60 dark:border-stone-800/60 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => router.back()}
                        className="p-1.5 rounded-full hover:bg-stone-200/50 dark:hover:bg-stone-800/50 transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6 text-stone-600 dark:text-stone-400" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight text-stone-900 dark:text-stone-50 flex items-center gap-1.5">
                            <ChefHat className="w-5 h-5 text-emerald-600 dark:text-emerald-500 animate-pulse" />
                            여행 & 캠핑 레시피
                        </h1>
                        <p className="text-[10px] text-stone-500">숙소/야외 어디서나 초간단 조리 팁</p>
                    </div>
                </div>
                <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-full border border-emerald-100 dark:border-emerald-900/50">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">스마트 가이드</span>
                </div>
            </header>

            {/* Search Section */}
            <div className="px-4 py-3">
                <div className="relative w-full">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <Search className="w-4 h-4 text-stone-400" />
                    </span>
                    <input
                        type="text"
                        placeholder="요리 이름, 식재료, 또는 조리 팁 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:focus:ring-emerald-500/40 transition-all text-stone-800 dark:text-stone-100 placeholder-stone-400"
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery('')}
                            className="absolute inset-y-0 right-0 flex items-center pr-3"
                        >
                            <X className="w-4 h-4 text-stone-400 hover:text-stone-600" />
                        </button>
                    )}
                </div>
            </div>

            {/* 대분류 스크롤 탭 */}
            <div className="w-full overflow-x-auto scrollbar-none px-4 py-2 flex items-center gap-2.5">
                {parentCategories.map((parent) => {
                    const isActive = selectedParentId === parent.id;
                    return (
                        <button
                            key={parent.id}
                            onClick={() => setSelectedParentId(parent.id)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all shadow-sm ${
                                isActive 
                                    ? 'bg-emerald-700 text-white dark:bg-emerald-600 scale-102 shadow-emerald-700/10' 
                                    : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border border-stone-200/60 dark:border-stone-800/60 hover:bg-stone-50 dark:hover:bg-stone-800/50'
                            }`}
                        >
                            <span>{parent.icon_emoji}</span>
                            <span>{parent.name}</span>
                        </button>
                    );
                })}
            </div>

            {/* 소분류 칩 필터 */}
            {childCategories.length > 0 && (
                <div className="w-full overflow-x-auto scrollbar-none px-4 py-2.5 flex items-center gap-2">
                    {childCategories.map((child) => {
                        const isActive = selectedChildId === child.id;
                        return (
                            <button
                                key={child.id}
                                onClick={() => setSelectedChildId(child.id)}
                                className={`px-3.5 py-1.5 rounded-full text-xs transition-all border ${
                                    isActive
                                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/80 font-bold scale-[1.01]'
                                        : 'bg-stone-100 dark:bg-stone-900/50 text-stone-500 dark:text-stone-400 border-transparent hover:bg-stone-200/40 dark:hover:bg-stone-800/30'
                                }`}
                            >
                                {child.name}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* 요리 목록 그리드 */}
            <div className="px-4 py-2">
                <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-[11px] font-bold text-stone-400 tracking-wider uppercase">{activeCategoryName}</span>
                    <span className="text-[11px] font-medium text-stone-400">{filteredRecipes.length}개의 추천 요리</span>
                </div>

                {loading ? (
                    <div className="grid grid-cols-2 gap-3">
                        {[1, 2, 3, 4].map(idx => (
                            <div key={idx} className="bg-white dark:bg-stone-900 rounded-3xl p-3 border border-stone-200/50 dark:border-stone-800/50 space-y-2">
                                <div className="w-full h-28 bg-stone-200 dark:bg-stone-800 rounded-2xl animate-pulse" />
                                <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded w-3/4 animate-pulse" />
                                <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded w-1/2 animate-pulse" />
                            </div>
                        ))}
                    </div>
                ) : filteredRecipes.length === 0 ? (
                    <div className="w-full py-16 flex flex-col items-center justify-center text-center px-4 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/50 dark:border-stone-800/50 mt-2">
                        <Utensils className="w-10 h-10 text-stone-300 dark:text-stone-700 mb-3" />
                        <h3 className="text-sm font-bold text-stone-600 dark:text-stone-400">등록된 요리가 없습니다</h3>
                        <p className="text-xs text-stone-400 mt-1 max-w-[200px]">해당 카테고리에 맞는 요리 데이터를 준비 중입니다.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {filteredRecipes.map((recipe) => (
                            <div
                                key={recipe.id}
                                onClick={() => handleRecipeClick(recipe)}
                                className="group bg-white dark:bg-stone-900 hover:bg-stone-50/50 dark:hover:bg-stone-800/30 rounded-3xl p-3 border border-stone-200/60 dark:border-stone-800/60 shadow-sm active:scale-[0.98] transition-all cursor-pointer flex flex-col justify-between"
                            >
                                <div className="space-y-2.5">
                                    {/* Thumbnail Placeholder with Gradient background (saves image asset config) */}
                                    <div className="relative w-full h-28 rounded-2xl bg-gradient-to-tr from-emerald-800/10 to-teal-500/10 flex items-center justify-center overflow-hidden border border-emerald-500/5">
                                        <div className="absolute inset-0 flex items-center justify-center text-emerald-800/40 dark:text-emerald-400/20">
                                            <Utensils className="w-10 h-10 group-hover:scale-110 transition-transform" />
                                        </div>
                                        {recipe.travel_tips?.[0] && (
                                            <div className="absolute bottom-2 left-2 right-2 bg-stone-900/70 backdrop-blur-sm rounded-lg p-1 text-[9px] text-white line-clamp-1">
                                                💡 {recipe.travel_tips[0]}
                                            </div>
                                        )}
                                    </div>
                                    <h3 className="text-xs font-bold text-stone-900 dark:text-stone-50 line-clamp-2 px-1">
                                        {recipe.name}
                                    </h3>
                                </div>
                                <div className="mt-3 flex items-center justify-between px-1">
                                    <span className="text-[9px] text-stone-400 flex items-center gap-0.5">
                                        <BookOpen className="w-3 h-3" />
                                        재료 {recipe.ingredients?.length || 0}종
                                    </span>
                                    <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md">
                                        조리 꿀팁
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom Sheet - 요리 상세 */}
            {selectedRecipe && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm transition-all duration-300">
                    <div className="absolute inset-0" onClick={() => setSelectedRecipe(null)} />
                    <div className="relative w-full max-w-md bg-[#F7F5EF] dark:bg-[#0f0e0c] rounded-t-[32px] shadow-2xl flex flex-col max-h-[85vh] animate-slide-up border-t border-stone-200 dark:border-stone-800">
                        {/* Drag indicator handle */}
                        <div className="w-12 h-1 bg-stone-300 dark:bg-stone-700 rounded-full mx-auto my-3" />

                        {/* Top controls */}
                        <div className="px-5 pb-3 flex items-start justify-between">
                            <div className="space-y-1">
                                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                    {activeCategoryName}
                                </span>
                                <h2 className="text-base font-bold text-stone-950 dark:text-stone-50 flex items-center gap-1.5">
                                    {selectedRecipe.name}
                                </h2>
                            </div>
                            <button 
                                onClick={() => setSelectedRecipe(null)}
                                className="p-1 rounded-full bg-stone-200/50 dark:bg-stone-800/50 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-500 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Content Scroll area */}
                        <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-5">
                            {/* 장보기 재료 체크리스트 */}
                            <div className="bg-white dark:bg-stone-900 rounded-3xl p-4 border border-stone-200/50 dark:border-stone-800/50">
                                <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5 mb-3">
                                    <ShoppingBag className="w-4 h-4 text-emerald-600" />
                                    장보기 필수 재료 체크리스트
                                    <span className="text-[10px] text-stone-400 font-normal">(터치하여 체크)</span>
                                </h3>
                                <div className="grid grid-cols-1 gap-2">
                                    {selectedRecipe.ingredients.map((ing, idx) => {
                                        const isChecked = !!checkedIngredients[ing.name];
                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => toggleIngredient(ing.name)}
                                                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                                                    isChecked 
                                                        ? 'bg-stone-50/50 dark:bg-stone-950/20 border-stone-200/80 dark:border-stone-800 opacity-60' 
                                                        : 'bg-white dark:bg-stone-900 border-stone-100 dark:border-stone-800/50 hover:border-stone-200'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                                                        isChecked 
                                                            ? 'bg-emerald-600 border-emerald-600 text-white' 
                                                            : 'border-stone-300 dark:border-stone-700 bg-transparent'
                                                    }`}>
                                                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                                    </div>
                                                    <span className={`text-xs ${isChecked ? 'line-through text-stone-400' : 'text-stone-800 dark:text-stone-200 font-medium'}`}>
                                                        {ing.name}
                                                    </span>
                                                </div>
                                                <span className="text-[11px] text-stone-400 font-medium">{ing.amount}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 여행 꿀팁 */}
                            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-3xl p-4 border border-emerald-100/50 dark:border-emerald-900/30">
                                <h3 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 mb-2.5">
                                    <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    여행지 원포인트 조리 팁
                                </h3>
                                <ul className="space-y-2">
                                    {selectedRecipe.travel_tips.map((tip, idx) => (
                                        <li key={idx} className="flex gap-2 text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                                            <span className="text-emerald-600 font-bold shrink-0">{idx + 1}.</span>
                                            <span>{tip}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* 미디어 연동 링크 */}
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-stone-400 text-center uppercase tracking-wider">상세 레시피 영상 / 비주얼 탐색</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <Button
                                        onClick={() => handleSocialSearch('youtube', selectedRecipe)}
                                        className="w-full bg-[#FF0000] hover:bg-[#CC0000] text-white gap-2 py-5 rounded-2xl font-bold text-xs"
                                    >
                                        <Youtube className="w-4 h-4" />
                                        유튜브 레시피 검색
                                    </Button>
                                    <Button
                                        onClick={() => handleSocialSearch('instagram', selectedRecipe)}
                                        className="w-full bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-90 text-white gap-2 py-5 rounded-2xl font-bold text-xs"
                                    >
                                        <Instagram className="w-4 h-4" />
                                        인스타 숏폼 꿀팁
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
