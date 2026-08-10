'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
    Info,
    List,
    RotateCcw
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import LocationPermissionPrompt from "@/components/permission/LocationPermissionPrompt";

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
    const [isMounted, setIsMounted] = useState<boolean>(false);
    const [categories, setCategories] = useState<CategoryNode[]>([]);
    const [recipes, setRecipes] = useState<RecipeItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [localQuery, setLocalQuery] = useState<string>('');
    const [showLocationPrompt, setShowLocationPrompt] = useState<boolean>(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        const handler = setTimeout(() => {
            setSearchQuery(localQuery);
        }, 250);
        return () => clearTimeout(handler);
    }, [localQuery]);
 
    // Navigation state
    const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
    const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
 
    // Tab mode: 'list' (List), 'roulette' (Roulette), 'card' (Card Flip)
    const [activeTabMode, setActiveTabMode] = useState<'list' | 'roulette' | 'card'>('list');
 
    // Bottom sheet details state
    const [selectedRecipe, setSelectedRecipe] = useState<RecipeItem | null>(null);
    const [recommendedRecipes, setRecommendedRecipes] = useState<RecipeItem[]>([]);
    // Bottom sheet details state (checkedIngredients moved inside LocalRecipeDetailSheet)
 
    // Profile & Weather states for recommendation
    const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
    const [recommending, setRecommending] = useState<boolean>(false);
 
    // Roulette States
    const [rouletteItems, setRouletteItems] = useState<RecipeItem[]>([]);
    const [isSpinning, setIsSpinning] = useState<boolean>(false);
    const [spinAngle, setSpinAngle] = useState<number>(0);
 
    // Card Flip States
    const [cardItems, setCardItems] = useState<RecipeItem[]>([]);
    const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});
 
    // Color array for Roulette slices
    const rouletteColors = ['#047857', '#059669', '#10B981', '#34D399', '#0284C7', '#0EA5E9', '#38BDF8', '#6EE7B7'];
 
    // Filter parent & child categories
    const parentCategories = useMemo(() => {
        return categories.filter(c => c.parent_id === null);
    }, [categories]);
 
    const childCategories = useMemo(() => {
        if (selectedParentId === null) return [];
        return categories.filter(c => c.parent_id === selectedParentId);
    }, [categories, selectedParentId]);
 
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

    // Automatically select the 'All' or first child category when parent changes
    useEffect(() => {
        if (childCategories.length > 0) {
            setSelectedChildId(childCategories[0].id); // Defaults to first child (e.g., 'All' or specific tag)
        } else {
            setSelectedChildId(null);
        }
    }, [selectedParentId, childCategories]);

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
 
    // Fetch user profile on mount
    useEffect(() => {
        supabase.auth.getUser().then(async ({ data: { user } }) => {
            if (user) {
                const { data } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                setCurrentUserProfile(data);
            }
        });
    }, []);
 
    // Synchronize Roulette & Card Flip slots when filter outputs modify
    useEffect(() => {
        if (filteredRecipes.length > 0) {
            const shuffled = [...filteredRecipes].sort(() => 0.5 - Math.random());
            setRouletteItems(shuffled.slice(0, Math.min(8, shuffled.length)));
            setCardItems(shuffled.slice(0, Math.min(3, shuffled.length)));
            setFlippedCards({});
        } else {
            setRouletteItems([]);
            setCardItems([]);
            setFlippedCards({});
        }
        setSpinAngle(0);
        setIsSpinning(false);
    }, [filteredRecipes]);
 
    // Reset Card Flips manually
    const handleResetCards = () => {
        if (filteredRecipes.length > 0) {
            const shuffled = [...filteredRecipes].sort(() => 0.5 - Math.random());
            setCardItems(shuffled.slice(0, Math.min(3, shuffled.length)));
            setFlippedCards({});
            toast.success("카드가 무작위로 새로 섞였습니다!");
        }
    };
 
    interface WeatherData {
        type: 'sunny' | 'partly_cloudy' | 'cloudy' | 'rainy' | 'snowy' | 'unknown';
        temp: number | null;
    }
 
    // 4-Hour Location-Aware Weather Cache Lookup
    const getWeatherFromCacheOrAPI = async (lat: number, lng: number): Promise<WeatherData> => {
        const cacheKey = `weather_recipe_cache`;
        let cachedStr: string | null = null;
        try { cachedStr = window.sessionStorage?.getItem(cacheKey); } catch {}
        if (cachedStr) {
            try {
                const cached = JSON.parse(cachedStr);
                const now = new Date().getTime();
                if (now - cached.timestamp < 4 * 3600 * 1000) {
                    return {
                        type: cached.weather.type,
                        temp: cached.weather.temp
                    };
                }
            } catch (e) {
                console.warn("Error parsing weather cache:", e);
            }
        }
 
        // Fetch fresh weather
        const response = await fetch(`/api/weather?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`);
        if (!response.ok) {
            throw new Error('Weather API request failed');
        }
        const data = await response.json();
        if (data.error) throw new Error(data.error);
 
        const todayFcst = data.daily?.[0];
        let type: WeatherData['type'] = 'sunny';
        if (todayFcst && todayFcst.weatherCode) {
            type = todayFcst.weatherCode;
        }
 
        const weatherResult: WeatherData = {
            type,
            temp: data.current?.temp ?? null
        };
 
        try {
            window.sessionStorage?.setItem(cacheKey, JSON.stringify({
                timestamp: new Date().getTime(),
                weather: weatherResult
            }));
        } catch {}
 
        return weatherResult;
    };
 
    // 1. 실제 레시피 추천 실행 로직
    const executeRecommendRecipe = async () => {
        setRecommending(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                await processRecommendation(latitude, longitude);
            },
            async (err) => {
                console.warn("Geolocation denied/failed. Fallback to RAON.I location.", err);
                const DEFAULT_LAT = 36.7821;
                const DEFAULT_LNG = 126.8324;
                await processRecommendation(DEFAULT_LAT, DEFAULT_LNG);
            },
            { timeout: 7000 }
        );
    };

    // Client-side Recipe scoring and recommendation handler (분기 핸들러)
    const handleRecommendRecipe = async () => {
        if (filteredRecipes.length === 0) {
            toast.error("현재 조건에 맞는 레시피 정보가 없습니다.");
            return;
        }

        if (typeof navigator !== 'undefined' && navigator.permissions) {
            try {
                const status = await navigator.permissions.query({ name: 'geolocation' });
                if (status.state === 'denied' || status.state === 'prompt') {
                    setShowLocationPrompt(true);
                    return;
                }
            } catch (e) {
                // Pass through if permissions.query is unsupported (Safari, etc.)
            }
        }

        await executeRecommendRecipe();
    };
 
    const processRecommendation = async (lat: number, lng: number) => {
        try {
            const weather = await getWeatherFromCacheOrAPI(lat, lng);
            
            // Score Recipes
            const scored = filteredRecipes.map(recipe => {
                let score = 50; // Base score
                const textPool = `${recipe.name} ${recipe.travel_tips.join(' ')} ${recipe.ingredients.map(i => i.name).join(' ')}`.toLowerCase();
 
                // Weather rules
                const isRainyOrSnowy = weather.type === 'rainy' || weather.type === 'snowy';
                const isSunny = weather.type === 'sunny';
 
                if (isRainyOrSnowy) {
                    const hasIndoorKeywords = textPool.includes('국물') || textPool.includes('탕') || textPool.includes('찌개') || textPool.includes('전골') || textPool.includes('얼큰') || textPool.includes('따끈') || textPool.includes('라면') || textPool.includes('전') || textPool.includes('부침개');
                    if (hasIndoorKeywords) score += 40;
                } else if (isSunny) {
                    const hasOutdoorKeywords = textPool.includes('구이') || textPool.includes('그릴') || textPool.includes('바베큐') || textPool.includes('꼬치') || textPool.includes('시원한') || textPool.includes('냉') || textPool.includes('비빔') || textPool.includes('무침');
                    if (hasOutdoorKeywords) score += 30;
                }
 
                // 기온 가이드
                if (weather.temp !== null) {
                    if (weather.temp < 15) {
                        const hasHotKeywords = textPool.includes('따뜻한') || textPool.includes('뜨끈') || textPool.includes('국물') || textPool.includes('탕') || textPool.includes('찌개') || textPool.includes('전골');
                        if (hasHotKeywords) score += 30;
                    } else if (weather.temp > 25) {
                        const hasColdKeywords = textPool.includes('시원한') || textPool.includes('냉') || textPool.includes('비빔') || textPool.includes('무침') || textPool.includes('간단') || textPool.includes('초간단');
                        if (hasColdKeywords) score += 30;
                    }
                }
 
                // 페르소나 가이드 (profiles.family_type)
                if (currentUserProfile) {
                    const familyType = currentUserProfile.family_type;
                    if (familyType === 'family') {
                        const hasKidsKeywords = textPool.includes('아이') || textPool.includes('어린이') || textPool.includes('자녀') || textPool.includes('가족') || textPool.includes('안매운') || textPool.includes('달콤') || textPool.includes('치즈') || textPool.includes('소시지');
                        if (hasKidsKeywords) score += 40;
                    } else if (familyType === 'couple') {
                        const hasCoupleKeywords = textPool.includes('커플') || textPool.includes('안주') || textPool.includes('와인') || textPool.includes('맥주') || textPool.includes('소주') || textPool.includes('스테이크') || textPool.includes('파스타') || textPool.includes('하이볼') || textPool.includes('분위기');
                        if (hasCoupleKeywords) score += 30;
                    }
                }
 
                return { recipe, score };
            });
 
            scored.sort((a, b) => b.score - a.score);
            
            // 상위 3개 추천 추출
            const top3Recipes = scored.slice(0, 3).map(s => s.recipe);
 
            setTimeout(() => {
                setRecommending(false);
                setRecommendedRecipes(top3Recipes);
                
                let weatherMsg = '';
                if (weather.type === 'rainy') weatherMsg = '🌧️ 비가 오는 날씨군요! 따끈하고 얼큰한';
                else if (weather.type === 'snowy') weatherMsg = '❄️ 눈이 오는 날씨군요! 포근하고 따뜻한';
                else if (weather.type === 'sunny') weatherMsg = '☀️ 화창한 날씨군요! 맛있는 야외 그릴/바베큐';
                else weatherMsg = '🍳 오늘 여행에 딱 맞는';
 
                toast.success(`${weatherMsg} 레시피를 엄선하여 3가지 추천해 드려요!`);
            }, 1000);
 
        } catch (e: any) {
            console.error("Recipe recommendation failed:", e);
            setRecommending(false);
            const shuffled = [...filteredRecipes].sort(() => 0.5 - Math.random());
            const fallback3 = shuffled.slice(0, 3);
            setRecommendedRecipes(fallback3);
            toast("⚠️ 날씨 연동 실패로 인기 레시피를 추천해 드려요!");
        }
    };
 
    // Spin Roulette
    const handleSpinRoulette = () => {
        if (isSpinning || rouletteItems.length === 0) return;
 
        setIsSpinning(true);
        const targetIdx = Math.floor(Math.random() * rouletteItems.length);
        const sliceAngle = 360 / rouletteItems.length;
        
        const additionalRotations = 1800;
        const targetAngle = 360 - (targetIdx * sliceAngle) - (sliceAngle / 2);
        const finalAngle = spinAngle + additionalRotations + targetAngle;
        
        setSpinAngle(finalAngle);
 
        setTimeout(() => {
            setIsSpinning(false);
            const chosen = rouletteItems[targetIdx];
            handleRecipeClick(chosen);
            toast.success(`🎯 룰렛 결과: "${chosen.name}" 레시피가 선택되었습니다!`);
        }, 4000);
    };
 
    // Handle Card Flip
    const handleCardFlip = (idx: number) => {
        if (flippedCards[idx]) return;
        setFlippedCards(prev => ({ ...prev, [idx]: true }));
    };



    // Handle Open Detail Sheet
    const handleRecipeClick = (recipe: RecipeItem) => {
        setSelectedRecipe(recipe);
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

    // Toggle Ingredient Checklist (REMOVED - Managed inside LocalRecipeDetailSheet)

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

    if (!isMounted) {
        return (
            <div className="w-full min-h-screen bg-[#F7F5EF] dark:bg-[#0f0e0c] flex items-center justify-center text-stone-400 text-sm">
                로딩 중...
            </div>
        );
    }

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
            </header>

            <div className="px-4 py-3">
                <div className="relative w-full">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <Search className="w-4 h-4 text-stone-400" />
                    </span>
                    <input
                        type="text"
                        placeholder="요리 이름, 식재료, 또는 조리 팁 검색..."
                        value={localQuery}
                        onChange={(e) => setLocalQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:focus:ring-emerald-500/40 transition-all text-stone-800 dark:text-stone-100 placeholder-stone-400"
                    />
                    {localQuery && (
                        <button 
                            onClick={() => setLocalQuery('')}
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

            {/* AI Recommendation Banner */}
            <div className="px-4 py-2">
                <div className="bg-gradient-to-br from-emerald-800 to-teal-700 rounded-3xl p-5 text-white shadow-md relative overflow-hidden">
                    <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-15 pointer-events-none">
                        <Sparkles className="w-28 h-28" />
                    </div>
                    <div className="relative z-10 space-y-3">
                        <div>
                            <h2 className="text-base font-bold flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-yellow-200 animate-pulse" />
                                실시간 레시피 매칭
                            </h2>
                            <p className="text-xs text-white/90 leading-relaxed mt-1">
                                선택하신 요리 유형 안에서, 현재 캠핑장 날씨(기온, 우천)와 사용자 프로필(가족/연인/개인)을 종합 분석하여 오늘 만들어 먹기 딱 좋은 맞춤 메뉴를 추천해 드립니다!
                            </p>
                        </div>
                        <Button
                            onClick={handleRecommendRecipe}
                            disabled={recommending}
                            className="w-full bg-white hover:bg-stone-100 text-emerald-800 font-extrabold text-sm py-5 rounded-2xl shadow-sm transition-all active:scale-[0.98]"
                        >
                            {recommending ? (
                                <span className="flex items-center gap-2">
                                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-700 border-t-transparent" />
                                    현지 기상 분석 및 맞춤 메뉴 선정 중...
                                </span>
                            ) : (
                                "🎲 오늘의 맞춤 레시피 추천받기"
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Interactive Mode Swapper Tab */}
            <div className="px-4 py-3 flex gap-1.5">
                <button
                    onClick={() => setActiveTabMode('list')}
                    className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                        activeTabMode === 'list'
                            ? 'bg-emerald-800 text-white dark:bg-emerald-700 border-transparent shadow-sm'
                            : 'bg-white dark:bg-stone-900 text-stone-500 border-stone-200/50 hover:bg-stone-50'
                    }`}
                >
                    <List className="w-3.5 h-3.5" />
                    리스트 목록
                </button>
                <button
                    onClick={() => setActiveTabMode('roulette')}
                    className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                        activeTabMode === 'roulette'
                            ? 'bg-emerald-800 text-white dark:bg-emerald-700 border-transparent shadow-sm'
                            : 'bg-white dark:bg-stone-900 text-stone-500 border-stone-200/50 hover:bg-stone-50'
                    }`}
                >
                    🎯 룰렛 돌리기
                </button>
                <button
                    onClick={() => setActiveTabMode('card')}
                    className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                        activeTabMode === 'card'
                            ? 'bg-emerald-800 text-white dark:bg-emerald-700 border-transparent shadow-sm'
                            : 'bg-white dark:bg-stone-900 text-stone-500 border-stone-200/50 hover:bg-stone-50'
                    }`}
                >
                    🃏 카드 뒤집기
                </button>
            </div>

            {/* Content Area based on Mode */}
            {activeTabMode === 'list' && (
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
                                    <div className="space-y-2">
                                        <h3 className="text-xs font-bold text-stone-900 dark:text-stone-50 line-clamp-2 px-1">
                                            {recipe.name}
                                        </h3>
                                        {recipe.travel_tips?.[0] && (
                                            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-2.5 leading-relaxed line-clamp-2">
                                                💡 {recipe.travel_tips[0]}
                                            </p>
                                        )}
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
            )}

            {/* Roulette Spinning View */}
            {activeTabMode === 'roulette' && (
                <div className="px-4 py-2 animate-in fade-in duration-300">
                    <div className="flex flex-col items-center py-6 space-y-6 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/50 dark:border-stone-800/50 p-5 shadow-sm">
                        <div className="text-center space-y-1">
                            <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200">🎯 복불복 메뉴 선택 룰렛</h3>
                            <p className="text-[10px] text-stone-400">카테고리 레시피 목록에서 추출된 8개 요리 중 오늘의 운명의 한 끼를 뽑으세요!</p>
                        </div>

                        {rouletteItems.length === 0 ? (
                            <div className="py-12 text-center text-xs text-stone-400">
                                룰렛을 돌릴 레시피 정보가 부족합니다. 필터 카테고리를 변경해보세요.
                            </div>
                        ) : (
                            <div className="relative flex flex-col items-center">
                                {/* Pointer Indicator (12 o'clock) */}
                                <div className="absolute -top-3 z-30 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[18px] border-t-red-600 drop-shadow-md" />

                                {/* Roulette Wheel */}
                                <div 
                                    className="w-64 h-64 rounded-full border-4 border-stone-800 dark:border-stone-950 relative overflow-hidden shadow-lg"
                                    style={{
                                        background: `conic-gradient(${rouletteItems.map((_, idx) => {
                                            const sliceAngle = 360 / rouletteItems.length;
                                            const start = idx * sliceAngle;
                                            const end = (idx + 1) * sliceAngle;
                                            return `${rouletteColors[idx % rouletteColors.length]} ${start}deg ${end}deg`;
                                        }).join(', ')})`,
                                        transform: `rotate(${spinAngle}deg)`,
                                        transition: isSpinning ? 'transform 4s cubic-bezier(0.1, 0.8, 0.1, 1)' : 'none'
                                    }}
                                >
                                    {/* Labels */}
                                    {rouletteItems.map((item, idx) => {
                                        const sliceAngle = 360 / rouletteItems.length;
                                        const angle = (idx * sliceAngle) + (sliceAngle / 2);
                                        return (
                                            <div
                                                key={item.id}
                                                className="absolute top-0 left-0 w-full h-full text-white text-[9px] font-black pointer-events-none"
                                                style={{
                                                    transform: `rotate(${angle}deg)`,
                                                    transformOrigin: '50% 50%',
                                                }}
                                            >
                                                <div 
                                                    className="mx-auto mt-4 w-12 text-center break-all leading-tight drop-shadow-md line-clamp-2"
                                                    style={{ transform: 'rotate(0deg)' }}
                                                >
                                                    {item.name}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Center Cap */}
                                <div className="absolute w-8 h-8 rounded-full bg-stone-900 border-2 border-white shadow-md z-20 top-28" />

                                {/* Spin Button */}
                                <div className="pt-6 w-full max-w-[200px]">
                                    <Button
                                        onClick={handleSpinRoulette}
                                        disabled={isSpinning}
                                        className="w-full py-5 rounded-2xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow active:scale-95 transition-all"
                                    >
                                        {isSpinning ? "🎲 룰렛 회전 중..." : "🎯 룰렛 돌리기"}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Card Flip View */}
            {activeTabMode === 'card' && (
                <div className="px-4 py-2 animate-in fade-in duration-300">
                    <div className="space-y-6 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/50 dark:border-stone-800/50 p-5 shadow-sm">
                        <div className="text-center space-y-1">
                            <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200">🃏 운명의 3D 카드 뒤집기</h3>
                            <p className="text-[10px] text-stone-400">뒤집혀 있는 카드 중 하나를 선택해 오늘 만들 요리를 열어보세요!</p>
                        </div>

                        {cardItems.length === 0 ? (
                            <div className="py-12 text-center text-xs text-stone-400">
                                섞을 레시피 정보가 부족합니다. 필터 카테고리를 변경해 보세요.
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Card Grid */}
                                <div className="grid grid-cols-3 gap-3">
                                    {cardItems.map((recipe, idx) => {
                                        const isFlipped = !!flippedCards[idx];
                                        return (
                                            <div 
                                                key={recipe.id}
                                                className="w-full aspect-[2.6/4] cursor-pointer"
                                                onClick={() => handleCardFlip(idx)}
                                                style={{ perspective: '1000px' }}
                                            >
                                                {/* Card Wrapper (performs 3D rotation) */}
                                                <div 
                                                    className="relative w-full h-full duration-500 shadow-md rounded-2xl"
                                                    style={{ 
                                                        transformStyle: 'preserve-3d',
                                                        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                                                        transition: 'transform 0.6s'
                                                    }}
                                                >
                                                    {/* Front Side (Card back visible initially) */}
                                                    <div 
                                                        className="absolute inset-0 bg-gradient-to-br from-emerald-700 to-emerald-950 rounded-2xl border-4 border-emerald-500/30 flex flex-col items-center justify-center text-emerald-200"
                                                        style={{ backfaceVisibility: 'hidden' }}
                                                    >
                                                        <span className="text-2xl">🍳</span>
                                                        <span className="text-[8px] font-black tracking-widest mt-1">FLIP</span>
                                                    </div>

                                                    {/* Back Side (Recipe data visible after flip) */}
                                                    <div 
                                                        className="absolute inset-0 bg-[#F7F5EF] dark:bg-stone-900 rounded-2xl border border-emerald-500 p-2 flex flex-col justify-between"
                                                        style={{ 
                                                            backfaceVisibility: 'hidden',
                                                            transform: 'rotateY(180deg)'
                                                        }}
                                                    >
                                                        <div className="space-y-1.5 overflow-hidden">
                                                            <span className="text-[7px] font-extrabold text-emerald-600 block leading-none">RECOMMEND</span>
                                                            <h4 className="text-[9px] font-bold text-stone-900 dark:text-stone-100 line-clamp-2 leading-snug">{recipe.name}</h4>
                                                            <p className="text-[8px] text-stone-500 leading-normal line-clamp-3">{recipe.travel_tips?.[0] || '초간단 캠핑 요리 팁'}</p>
                                                        </div>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRecipeClick(recipe);
                                                            }}
                                                            className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[8px] font-bold mt-1.5"
                                                        >
                                                            자세히 보기
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Reshuffle Action */}
                                <div className="flex justify-center">
                                    <Button
                                        onClick={handleResetCards}
                                        className="py-2.5 px-6 h-auto bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl text-[10px] font-extrabold"
                                    >
                                        🃏 다른 카드 섞기
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 3개 추천 결과 팝업 모달 */}
            {recommendedRecipes.length > 0 && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="absolute inset-0" onClick={() => setRecommendedRecipes([])} />
                    <div className="relative w-full max-w-sm bg-[#F7F5EF] dark:bg-[#0f0e0c] rounded-3xl p-6 shadow-2xl animate-fade-in border border-stone-200 dark:border-stone-800 flex flex-col max-h-[85vh] overflow-y-auto scrollbar-hide">
                        <div className="text-center mb-5">
                            <span className="text-xl">🍳</span>
                            <h3 className="text-lg font-black text-stone-900 dark:text-stone-100 mt-2">라온아이 엄선 레시피 3선</h3>
                            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">오늘 날씨와 취향에 어울리는 캠핑 레시피입니다.</p>
                        </div>
                        
                        <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                            {recommendedRecipes.map((recipe) => (
                                <div
                                    key={recipe.id}
                                    onClick={() => {
                                        handleRecipeClick(recipe);
                                        setRecommendedRecipes([]);
                                    }}
                                    className="p-4 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl hover:border-emerald-600 dark:hover:border-emerald-500 cursor-pointer transition-all active:scale-[0.98] duration-200 shadow-sm"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 px-2 py-0.5 rounded-md">
                                            {recipe.category_id ? categories.find(c => c.id === recipe.category_id)?.name : '추천 요리'}
                                        </span>
                                        <span className="text-[10px] text-stone-400 font-semibold">{recipe.ingredients.length}개 재료</span>
                                    </div>
                                    <h4 className="font-extrabold text-[14px] text-stone-900 dark:text-stone-100 truncate">{recipe.name}</h4>
                                    <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 line-clamp-1">
                                        {recipe.travel_tips[0] || '캠핑 추천 요리'}
                                    </p>
                                </div>
                            ))}
                        </div>
                        
                        <Button
                            onClick={() => setRecommendedRecipes([])}
                            className="mt-5 w-full bg-[#224732] hover:bg-[#1a3626] text-white rounded-xl py-3 font-bold text-xs"
                        >
                            닫기
                        </Button>
                    </div>
                </div>
            )}

            {/* Bottom Sheet - 요리 상세 */}
            {selectedRecipe && (
                <LocalRecipeDetailSheet
                    recipe={selectedRecipe}
                    onClose={() => setSelectedRecipe(null)}
                    activeCategoryName={activeCategoryName}
                    parentCategories={parentCategories}
                    selectedParentId={selectedParentId}
                />
            )}

            <LocationPermissionPrompt
                isOpen={showLocationPrompt}
                onAccept={async () => {
                    setShowLocationPrompt(false);
                    await executeRecommendRecipe();
                }}
                onDismiss={async () => {
                    setShowLocationPrompt(false);
                    // 위치 거절 시 기본 좌표로 추천 강제 기동
                    setRecommending(true);
                    const DEFAULT_LAT = 36.7821;
                    const DEFAULT_LNG = 126.8324;
                    await processRecommendation(DEFAULT_LAT, DEFAULT_LNG);
                }}
            />
        </div>
    );
}

interface LocalRecipeDetailSheetProps {
    recipe: RecipeItem;
    onClose: () => void;
    activeCategoryName: string;
    parentCategories: CategoryNode[];
    selectedParentId: number | null;
}

function LocalRecipeDetailSheet({ 
    recipe, 
    onClose, 
    activeCategoryName, 
    parentCategories, 
    selectedParentId 
}: LocalRecipeDetailSheetProps) {
    const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});
    
    const toggleIngredient = (name: string) => {
        setCheckedIngredients(prev => ({
            ...prev,
            [name]: !prev[name]
        }));
    };

    const handleSocialSearch = (platform: 'youtube' | 'instagram', targetRecipe: RecipeItem) => {
        const parentName = parentCategories.find(p => p.id === selectedParentId)?.name || '';
        let keyword = platform === 'youtube' ? targetRecipe.youtube_search_keyword : targetRecipe.instagram_search_keyword;
        
        if (!keyword) {
            keyword = `${parentName} ${targetRecipe.name}`;
        }
        
        const encoded = encodeURIComponent(keyword);
        const url = platform === 'youtube' 
            ? `https://www.youtube.com/results?search_query=${encoded}`
            : `https://www.instagram.com/explore/tags/${encoded.replace(/%/g, '')}`;
        
        window.open(url, '_blank');
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm transition-all duration-300">
            <div className="absolute inset-0" onClick={onClose} />
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
                            {recipe.name}
                        </h2>
                    </div>
                    <button 
                        onClick={onClose}
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
                            {recipe.ingredients.map((ing, idx) => {
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
                            {recipe.travel_tips.map((tip, idx) => (
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
                                onClick={() => handleSocialSearch('youtube', recipe)}
                                className="w-full bg-[#FF0000] hover:bg-[#CC0000] text-white gap-2 py-5 rounded-2xl font-bold text-xs"
                            >
                                <Youtube className="w-4 h-4" />
                                유튜브 레시피 검색
                            </Button>
                            <Button
                                onClick={() => handleSocialSearch('instagram', recipe)}
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
    );
}
