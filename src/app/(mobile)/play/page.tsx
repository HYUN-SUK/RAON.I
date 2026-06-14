'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase-client';
import { 
    ChevronLeft, 
    Search, 
    Sparkles, 
    X, 
    Play, 
    Pause, 
    RotateCcw, 
    Compass, 
    Clock, 
    Star, 
    Check,
    AlertCircle,
    List,
    HelpCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Interfaces
interface PlayCategory {
    id: number;
    name: string;
    parent_id: number | null;
    icon_emoji?: string;
}

interface PlayItem {
    id: string;
    category_id: number;
    title: string;
    description: string;
    thumbnail_url?: string;
    difficulty: number;
    time_required: number;
    materials: string[];
    process_steps: string[];
    tips?: string;
    age_group?: string;
    view_count: number;
}

// Weather state matching useWeather
interface WeatherData {
    type: 'sunny' | 'partly_cloudy' | 'cloudy' | 'rainy' | 'snowy' | 'unknown';
    temp: number | null;
}

export default function PlayExplorerPage() {
    const router = useRouter();
    const supabase = createClient();

    // States
    const [categories, setCategories] = useState<PlayCategory[]>([]);
    const [plays, setPlays] = useState<PlayItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [recommending, setRecommending] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Active filters
    const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
    const [selectedChildId, setSelectedChildId] = useState<number | null>(null);

    // Navigation Tab Mode: 'list' (List), 'roulette' (Roulette), 'card' (Card Flip)
    const [activeTabMode, setActiveTabMode] = useState<'list' | 'roulette' | 'card'>('list');

    // Bottom sheet & recommendation results
    const [selectedPlay, setSelectedPlay] = useState<PlayItem | null>(null);
    const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);

    // Meditation Timer State
    const [timerSeconds, setTimerSeconds] = useState<number>(0);
    const [timerActive, setTimerActive] = useState<boolean>(false);
    const timerIntervalRef = useRef<any>(null);

    // Roulette States
    const [rouletteItems, setRouletteItems] = useState<PlayItem[]>([]);
    const [isSpinning, setIsSpinning] = useState<boolean>(false);
    const [spinAngle, setSpinAngle] = useState<number>(0);

    // Card Flip States
    const [cardItems, setCardItems] = useState<PlayItem[]>([]);
    const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});

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

        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        };
    }, []);

    // Load play categories & play items
    useEffect(() => {
        const loadPlayData = async () => {
            try {
                setLoading(true);
                // 1. Fetch categories
                const { data: catData, error: catErr } = await supabase
                    .from('travel_play_categories')
                    .select('*')
                    .order('sort_order', { ascending: true });

                if (catErr) throw catErr;
                setCategories(catData || []);

                // Select first parent category as initial
                const parents = (catData || []).filter(c => c.parent_id === null);
                if (parents.length > 0) {
                    setSelectedParentId(parents[0].id);
                }

                // 2. Fetch play items
                const { data: playData, error: playErr } = await supabase
                    .from('travel_plays')
                    .select('*')
                    .order('view_count', { ascending: false });

                if (playErr) throw playErr;
                setPlays(playData || []);

            } catch (err: any) {
                console.error("Error loading play recommendations:", err);
                toast.error("놀이 데이터를 불러올 수 없습니다. 테이블 생성 여부를 확인해 주세요.");
            } finally {
                setLoading(false);
            }
        };

        loadPlayData();
    }, []);

    // Memoized parent/child category lists
    const parentCategories = useMemo(() => {
        return categories.filter(c => c.parent_id === null);
    }, [categories]);

    const childCategories = useMemo(() => {
        if (selectedParentId === null) return [];
        return categories.filter(c => c.parent_id === selectedParentId);
    }, [categories, selectedParentId]);

    // Update child selection automatically when parent category changes
    useEffect(() => {
        if (childCategories.length > 0) {
            setSelectedChildId(childCategories[0].id);
        } else {
            setSelectedChildId(null);
        }
    }, [selectedParentId, childCategories]);

    const activeCategoryName = useMemo(() => {
        const parent = parentCategories.find(p => p.id === selectedParentId);
        const child = childCategories.find(c => c.id === selectedChildId);
        if (!parent) return '놀이';
        return `${parent.name} ${child ? `> ${child.name}` : ''}`;
    }, [parentCategories, childCategories, selectedParentId, selectedChildId]);

    // Filter play items by category & search query
    const filteredPlays = useMemo(() => {
        return plays.filter(play => {
            let matchesCategory = true;
            if (selectedChildId !== null) {
                matchesCategory = play.category_id === selectedChildId;
            } else if (selectedParentId !== null) {
                const childrenIds = categories.filter(c => c.parent_id === selectedParentId).map(c => c.id);
                matchesCategory = childrenIds.includes(play.category_id);
            }

            let matchesSearch = true;
            if (searchQuery.trim() !== '') {
                const query = searchQuery.toLowerCase();
                const titleMatch = play.title.toLowerCase().includes(query);
                const descMatch = play.description.toLowerCase().includes(query);
                const materialsMatch = play.materials.some(m => m.toLowerCase().includes(query));
                const stepsMatch = play.process_steps.some(s => s.toLowerCase().includes(query));
                const tipsMatch = play.tips?.toLowerCase().includes(query) || false;
                matchesSearch = titleMatch || descMatch || materialsMatch || stepsMatch || tipsMatch;
            }

            return matchesCategory && matchesSearch;
        });
    }, [plays, selectedParentId, selectedChildId, categories, searchQuery]);

    // Synchronize Roulette & Card Flip slots when filter outputs modify
    useEffect(() => {
        if (filteredPlays.length > 0) {
            const shuffled = [...filteredPlays].sort(() => 0.5 - Math.random());
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
    }, [filteredPlays]);

    // Reset Card Flips manually
    const handleResetCards = () => {
        if (filteredPlays.length > 0) {
            const shuffled = [...filteredPlays].sort(() => 0.5 - Math.random());
            setCardItems(shuffled.slice(0, Math.min(3, shuffled.length)));
            setFlippedCards({});
            toast.success("카드가 무작위로 새로 섞였습니다!");
        }
    };

    // Spin Roulette
    const handleSpinRoulette = () => {
        if (isSpinning || rouletteItems.length === 0) return;
        setIsSpinning(true);

        const targetIdx = Math.floor(Math.random() * rouletteItems.length);
        const sliceAngle = 360 / rouletteItems.length;
        
        // Stop angle aligns targeted slice to 12 o'clock position (270 degrees offset or simply matching top alignment)
        const stopAngle = 360 - (targetIdx * sliceAngle);
        const extraSpins = 360 * 5; // Spin 5 times
        const finalAngle = spinAngle + extraSpins + stopAngle - (spinAngle % 360);

        setSpinAngle(finalAngle);

        setTimeout(() => {
            setIsSpinning(false);
            const chosen = rouletteItems[targetIdx];
            toast.success(`🎯 룰렛 추천: "${chosen.title}"가 선택되었습니다!`);
            setTimeout(() => {
                handlePlayClick(chosen);
            }, 800);
        }, 4000);
    };

    // Handle Card Flip trigger
    const handleCardFlip = (idx: number) => {
        setFlippedCards(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }));
    };

    // Handle Open Detail Sheet
    const handlePlayClick = (play: PlayItem) => {
        setSelectedPlay(play);
        
        // Setup timer to defaults when opening
        setTimerSeconds(0);
        setTimerActive(false);
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }

        // Increment view count in background directly
        supabase.from('travel_plays')
            .update({ view_count: (play.view_count || 0) + 1 })
            .eq('id', play.id)
            .then(() => {});
    };

    // 4-Hour Location-Aware Weather Cache Lookup
    const getWeatherFromCacheOrAPI = async (lat: number, lng: number): Promise<WeatherData> => {
        const cacheKey = `weather_play_cache`;
        const cachedStr = localStorage.getItem(cacheKey);

        if (cachedStr) {
            try {
                const cached = JSON.parse(cachedStr);
                const now = Date.now();
                const isWithin4Hours = (now - cached.timestamp) < 4 * 3600 * 1000;
                
                // Location tolerance: around 0.05 degrees (approx. 5.5km)
                const isSameLocation = Math.abs(cached.lat - lat) < 0.05 && Math.abs(cached.lng - lng) < 0.05;

                if (isWithin4Hours && isSameLocation) {
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
        
        // Parse current type
        const pty = parseInt(data.current?.strPrecipitation || '0');
        let type: WeatherData['type'] = 'sunny';
        if (pty > 0) {
            type = (pty === 3 || pty === 7) ? 'snowy' : 'rainy';
        } else {
            const todayFcst = data.daily?.[0];
            if (todayFcst && todayFcst.weatherCode) {
                type = todayFcst.weatherCode;
            }
        }

        const weatherResult: WeatherData = {
            type,
            temp: data.current?.temp || null
        };

        // Save to LocalStorage
        localStorage.setItem(cacheKey, JSON.stringify({
            timestamp: Date.now(),
            lat,
            lng,
            weather: weatherResult
        }));

        return weatherResult;
    };

    // Client-side Play scoring and recommendation handler
    const handleRecommendPlay = () => {
        if (filteredPlays.length === 0) {
            toast.error("현재 조건에 맞는 놀이 정보가 없습니다.");
            return;
        }

        setRecommending(true);

        // Geolocation call
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                await processRecommendation(latitude, longitude);
            },
            async (err) => {
                console.warn("Geolocation denied/failed. Fallback to RAON.I location.", err);
                const DEFAULT_LAT = 36.7821; // RAON.I Camping site Lat
                const DEFAULT_LNG = 126.8324; // RAON.I Camping site Lng
                await processRecommendation(DEFAULT_LAT, DEFAULT_LNG);
            },
            { timeout: 7000 }
        );
    };

    const processRecommendation = async (lat: number, lng: number) => {
        try {
            // Get Weather (Cached or API)
            const weather = await getWeatherFromCacheOrAPI(lat, lng);
            
            // Score Plays
            const scored = filteredPlays.map(play => {
                let score = 50; // Base score
                const textPool = `${play.title} ${play.description} ${play.process_steps.join(' ')} ${play.tips || ''}`.toLowerCase();

                // Weather rules
                const isRainyOrSnowy = weather.type === 'rainy' || weather.type === 'snowy';
                const isSunny = weather.type === 'sunny';

                if (isRainyOrSnowy) {
                    const hasIndoorKeywords = textPool.includes('실내') || textPool.includes('텐트') || textPool.includes('안에서') || textPool.includes('보드게임') || textPool.includes('카드');
                    const hasOutdoorKeywords = textPool.includes('실외') || textPool.includes('야외') || textPool.includes('운동장') || textPool.includes('체육');
                    
                    if (hasIndoorKeywords) score += 40;
                    if (hasOutdoorKeywords) score -= 50;
                } else if (isSunny) {
                    const hasOutdoorKeywords = textPool.includes('실외') || textPool.includes('야외') || textPool.includes('자연') || textPool.includes('산책') || textPool.includes('스포츠');
                    if (hasOutdoorKeywords) score += 30;
                }

                // Family type personalization
                if (currentUserProfile) {
                    const familyType = currentUserProfile.family_type;
                    if (familyType === 'family') {
                        const hasKidsKeywords = play.age_group === 'kids' || play.age_group === '전연령' || textPool.includes('가족') || textPool.includes('아이') || textPool.includes('어린이') || textPool.includes('자녀');
                        if (hasKidsKeywords) score += 40;
                    } else if (familyType === 'couple') {
                        const hasCoupleKeywords = textPool.includes('커플') || textPool.includes('연인') || textPool.includes('둘이') || textPool.includes('2인');
                        if (hasCoupleKeywords) score += 30;
                    }
                }

                return { play, score };
            });

            // Sort by score
            scored.sort((a, b) => b.score - a.score);
            
            const topScore = scored[0].score;
            const topCandidates = scored.filter(s => s.score >= topScore - 5);
            const selectedIdx = Math.floor(Math.random() * topCandidates.length);
            const chosenPlay = topCandidates[selectedIdx].play;

            // Display result
            setTimeout(() => {
                setRecommending(false);
                handlePlayClick(chosenPlay);
                
                let weatherMsg = '';
                if (weather.type === 'rainy') weatherMsg = '🌧️ 비가 오네요! 아늑한 실내 활동을';
                else if (weather.type === 'snowy') weatherMsg = '❄️ 눈이 오네요! 포근한 놀이를';
                else if (weather.type === 'sunny') weatherMsg = '☀️ 화창해요! 신나는 야외/캠핑 놀이를';
                else weatherMsg = '🎲 오늘 기분에 딱 맞는 놀이를';

                toast.success(`${weatherMsg} 엄선하여 추천해 드려요!`);
            }, 1000);

        } catch (e: any) {
            console.error("Recommendation failed:", e);
            setRecommending(false);
            const chosenPlay = filteredPlays[Math.floor(Math.random() * filteredPlays.length)];
            handlePlayClick(chosenPlay);
            toast("⚠️ 날씨 연동 실패로 임의로 매칭해 드려요!");
        }
    };

    // Meditation Timer Controls
    const startTimer = (seconds: number) => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
        }
        setTimerSeconds(seconds);
        setTimerActive(true);

        timerIntervalRef.current = setInterval(() => {
            setTimerSeconds(prev => {
                if (prev <= 1) {
                    clearInterval(timerIntervalRef.current);
                    timerIntervalRef.current = null;
                    setTimerActive(false);
                    triggerTimerAlert();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const toggleTimerActive = () => {
        if (timerActive) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
            setTimerActive(false);
        } else if (timerSeconds > 0) {
            setTimerActive(true);
            timerIntervalRef.current = setInterval(() => {
                setTimerSeconds(prev => {
                    if (prev <= 1) {
                        clearInterval(timerIntervalRef.current);
                        timerIntervalRef.current = null;
                        setTimerActive(false);
                        triggerTimerAlert();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
    };

    const resetTimer = () => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        setTimerSeconds(0);
        setTimerActive(false);
    };

    const triggerTimerAlert = () => {
        toast("🧘 명상 및 휴식 시간이 끝났습니다.", {
            description: "마음이 조금 더 편안해지셨기를 바랍니다.",
            action: {
                label: "닫기",
                onClick: () => {}
            }
        });
        
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate([200, 100, 200]);
        }

        // Web Audio synthetic notification beep
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                const ctx = new AudioContextClass();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, ctx.currentTime);
                osc.frequency.setValueAtTime(554.37, ctx.currentTime + 0.15);
                osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.3);
                gain.gain.setValueAtTime(0.2, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.65);
            }
        } catch(e) {}
    };

    const formatTimerText = (sec: number) => {
        const mins = Math.floor(sec / 60);
        const secs = sec % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Color array for Roulette slices
    const rouletteColors = ['#E28743', '#EAB308', '#10B981', '#3B82F6', '#6366F1', '#EC4899', '#8B5CF6', '#14B8A6'];

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
                            <Compass className="w-5 h-5 text-amber-600 dark:text-amber-500 animate-spin" style={{ animationDuration: '6s' }} />
                            여행 & 캠핑 놀이 탐색기
                        </h1>
                    </div>
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
                        placeholder="놀이 이름, 준비물, 또는 진행 팁 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-stone-900 border border-stone-200/60 dark:border-stone-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 dark:focus:ring-amber-500/40 transition-all text-stone-800 dark:text-stone-100 placeholder-stone-400"
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
                                    ? 'bg-amber-700 text-white dark:bg-amber-600 scale-102 shadow-amber-700/10' 
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
                                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800/80 font-bold scale-[1.01]'
                                        : 'bg-stone-100 dark:bg-stone-900/50 text-stone-500 dark:text-stone-400 border-transparent hover:bg-stone-200/40 dark:hover:bg-stone-800/30'
                                }`}
                            >
                                {child.name}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* 추천받기 Action Banner */}
            <div className="px-4 py-2">
                <div className="bg-gradient-to-br from-amber-600 to-orange-500 rounded-3xl p-5 text-white shadow-md relative overflow-hidden">
                    <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-15 pointer-events-none">
                        <Sparkles className="w-28 h-28" />
                    </div>
                    <div className="relative z-10 space-y-3">
                        <div>
                            <h2 className="text-base font-bold flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-yellow-200 animate-pulse" />
                                실시간 놀이 매칭
                            </h2>
                            <p className="text-xs text-white/90 leading-relaxed mt-1">
                                선택하신 여행 모드와 놀이 유형 안에서, 현재 위치의 날씨와 사용자 프로필을 종합 반영하여 오늘 즐기기 딱 좋은 놀이를 1개 엄선해 드립니다!
                            </p>
                        </div>
                        <Button
                            onClick={handleRecommendPlay}
                            disabled={recommending}
                            className="w-full bg-white hover:bg-stone-100 text-amber-800 font-extrabold text-sm py-5 rounded-2xl shadow-sm transition-all active:scale-[0.98]"
                        >
                            {recommending ? (
                                <span className="flex items-center gap-2">
                                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-amber-700 border-t-transparent" />
                                    현지 기상 분석 및 매칭 중...
                                </span>
                            ) : (
                                "🎲 오늘의 맞춤 놀이 추천받기"
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Interactive Mode Swapper Tab */}
            <div className="px-4 py-4 flex gap-1.5">
                <button
                    onClick={() => setActiveTabMode('list')}
                    className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                        activeTabMode === 'list'
                            ? 'bg-[#3E2723] text-white dark:bg-[#5D4037] border-transparent shadow-sm'
                            : 'bg-white dark:bg-stone-900 text-stone-500 border-stone-200/50 hover:bg-stone-50'
                    }`}
                >
                    <List className="w-3.5 h-3.5" />
                    리스트 목록
                </button>
                <button
                    onClick={() => setActiveTabMode('roulette')}
                    className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                        activeTabMode === 'roulette'
                            ? 'bg-[#3E2723] text-white dark:bg-[#5D4037] border-transparent shadow-sm'
                            : 'bg-white dark:bg-stone-900 text-stone-500 border-stone-200/50 hover:bg-stone-50'
                    }`}
                >
                    🎯 룰렛 돌리기
                </button>
                <button
                    onClick={() => setActiveTabMode('card')}
                    className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                        activeTabMode === 'card'
                            ? 'bg-[#3E2723] text-white dark:bg-[#5D4037] border-transparent shadow-sm'
                            : 'bg-white dark:bg-stone-900 text-stone-500 border-stone-200/50 hover:bg-stone-50'
                    }`}
                >
                    🃏 카드 뒤집기
                </button>
            </div>

            {/* Main Content Area based on Selected Mode */}
            <div className="px-4 py-1">
                {activeTabMode === 'list' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-[11px] font-bold text-stone-400 tracking-wider uppercase">{activeCategoryName}</span>
                            <span className="text-[11px] font-medium text-stone-400">{filteredPlays.length}개의 놀이 보유</span>
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
                        ) : filteredPlays.length === 0 ? (
                            <div className="w-full py-16 flex flex-col items-center justify-center text-center px-4 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/50 dark:border-stone-800/50 mt-2">
                                <AlertCircle className="w-10 h-10 text-stone-300 dark:text-stone-700 mb-3" />
                                <h3 className="text-sm font-bold text-stone-600 dark:text-stone-400">등록된 놀이가 없습니다</h3>
                                <p className="text-xs text-stone-400 mt-1 max-w-[200px]">해당 카테고리에 맞는 놀이 정보를 준비 중입니다.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                {filteredPlays.map((play) => (
                                    <div
                                        key={play.id}
                                        onClick={() => handlePlayClick(play)}
                                        className="group bg-white dark:bg-stone-900 hover:bg-stone-50/50 dark:hover:bg-stone-800/30 rounded-3xl p-3.5 border border-stone-200/60 dark:border-stone-800/60 shadow-sm active:scale-[0.98] transition-all cursor-pointer flex flex-col justify-between min-h-[140px]"
                                    >
                                        <div className="space-y-1.5">
                                            <h3 className="text-xs font-bold text-stone-900 dark:text-stone-50 line-clamp-2 px-1">
                                                {play.title}
                                            </h3>
                                            <p className="text-[10px] text-stone-500 line-clamp-2 px-1 leading-normal">
                                                {play.description}
                                            </p>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between px-1">
                                            <span className="text-[9px] text-stone-400 flex items-center gap-0.5">
                                                <Clock className="w-3 h-3 text-stone-400" />
                                                {play.time_required}분
                                            </span>
                                            <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                                <Star className="w-2.5 h-2.5 fill-current" />
                                                난이도 {play.difficulty}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTabMode === 'roulette' && (
                    <div className="flex flex-col items-center py-6 space-y-6 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/50 dark:border-stone-800/50 p-5 shadow-sm">
                        <div className="text-center space-y-1">
                            <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200">🎯 복불복 매칭 룰렛</h3>
                            <p className="text-[10px] text-stone-400">카테고리 놀이 목록에서 추출된 8개 놀이 중 운명의 액티비티를 뽑으세요!</p>
                        </div>

                        {rouletteItems.length === 0 ? (
                            <div className="py-12 text-center text-xs text-stone-400">
                                룰렛을 돌릴 놀이 정보가 부족합니다. 필터 카테고리를 변경해보세요.
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
                                                    className="mx-auto mt-4 w-12 text-center break-all leading-tight drop-shadow-md"
                                                    style={{ transform: 'rotate(0deg)' }}
                                                >
                                                    {item.title}
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
                                        className="w-full py-5 rounded-2xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow active:scale-95 transition-all"
                                    >
                                        {isSpinning ? "🎲 룰렛 회전 중..." : "🎯 룰렛 돌리기"}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTabMode === 'card' && (
                    <div className="space-y-6 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/50 dark:border-stone-800/50 p-5 shadow-sm">
                        <div className="text-center space-y-1">
                            <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200">🃏 운명의 3D 카드 뒤집기</h3>
                            <p className="text-[10px] text-stone-400">뒤집혀 있는 카드 중 하나를 선택해 오늘 할 놀이를 열어보세요!</p>
                        </div>

                        {cardItems.length === 0 ? (
                            <div className="py-12 text-center text-xs text-stone-400">
                                섞을 놀이 정보가 부족합니다. 필터 카테고리를 변경해 보세요.
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Card Grid */}
                                <div className="grid grid-cols-3 gap-3">
                                    {cardItems.map((play, idx) => {
                                        const isFlipped = !!flippedCards[idx];
                                        return (
                                            <div 
                                                key={play.id}
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
                                                        className="absolute inset-0 bg-gradient-to-br from-amber-700 to-amber-900 rounded-2xl border-4 border-amber-500/30 flex flex-col items-center justify-center text-amber-200"
                                                        style={{ backfaceVisibility: 'hidden' }}
                                                    >
                                                        <span className="text-2xl">✨</span>
                                                        <span className="text-[8px] font-black tracking-widest mt-1">FLIP</span>
                                                    </div>

                                                    {/* Back Side (Play data visible after flip) */}
                                                    <div 
                                                        className="absolute inset-0 bg-[#F7F5EF] dark:bg-stone-850 rounded-2xl border border-amber-500 p-2 flex flex-col justify-between"
                                                        style={{ 
                                                            backfaceVisibility: 'hidden',
                                                            transform: 'rotateY(180deg)'
                                                        }}
                                                    >
                                                        <div className="space-y-1.5 overflow-hidden">
                                                            <span className="text-[7px] font-extrabold text-amber-600 block leading-none">RECOMMEND</span>
                                                            <h4 className="text-[9px] font-bold text-stone-900 dark:text-stone-100 line-clamp-2 leading-snug">{play.title}</h4>
                                                            <p className="text-[8px] text-stone-500 leading-normal line-clamp-3">{play.description}</p>
                                                        </div>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handlePlayClick(play);
                                                            }}
                                                            className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[8px] font-bold mt-1.5"
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
                )}
            </div>

            {/* Bottom Sheet - 놀이 상세 */}
            {selectedPlay && (
                <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm transition-all duration-300">
                    <div className="absolute inset-0" onClick={() => setSelectedPlay(null)} />
                    <div className="relative w-full max-w-md bg-[#F7F5EF] dark:bg-[#0f0e0c] rounded-t-[32px] shadow-2xl flex flex-col max-h-[90vh] animate-slide-up border-t border-stone-200 dark:border-stone-800">
                        {/* Drag indicator handle */}
                        <div className="w-12 h-1 bg-stone-300 dark:bg-stone-700 rounded-full mx-auto my-3" />

                        {/* Top controls */}
                        <div className="px-5 pb-3 flex items-start justify-between">
                            <div className="space-y-1">
                                <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                                    {activeCategoryName}
                                </span>
                                <h2 className="text-base font-bold text-stone-950 dark:text-stone-50 flex items-center gap-1.5">
                                    {selectedPlay.title}
                                </h2>
                            </div>
                            <button 
                                onClick={() => setSelectedPlay(null)}
                                className="p-1.5 rounded-full bg-stone-200/50 dark:bg-stone-800/50 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-500 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Content Scroll area */}
                        <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-5">
                            {/* 소개 */}
                            <div className="bg-white dark:bg-stone-900 rounded-3xl p-4 border border-stone-200/50 dark:border-stone-800/50 text-xs leading-relaxed text-stone-600 dark:text-stone-300">
                                <p>{selectedPlay.description}</p>
                            </div>

                            {/* 놀이 정보 요약 */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-white dark:bg-stone-900 rounded-2xl p-2.5 border border-stone-200/50 dark:border-stone-800/50 text-center space-y-0.5">
                                    <span className="text-[10px] text-stone-400 block">난이도</span>
                                    <div className="flex justify-center gap-0.5 text-amber-500">
                                        {Array.from({ length: selectedPlay.difficulty }).map((_, i) => (
                                            <Star key={i} className="w-3.5 h-3.5 fill-current" />
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-stone-900 rounded-2xl p-2.5 border border-stone-200/50 dark:border-stone-800/50 text-center space-y-0.5">
                                    <span className="text-[10px] text-stone-400 block">소요 시간</span>
                                    <span className="text-xs font-bold text-stone-800 dark:text-stone-200">{selectedPlay.time_required}분 내외</span>
                                </div>
                                <div className="bg-white dark:bg-stone-900 rounded-2xl p-2.5 border border-stone-200/50 dark:border-stone-800/50 text-center space-y-0.5">
                                    <span className="text-[10px] text-stone-400 block">권장 대상</span>
                                    <span className="text-[10px] font-bold text-stone-800 dark:text-stone-200 truncate block px-0.5">
                                        {selectedPlay.age_group || '누구나'}
                                    </span>
                                </div>
                            </div>

                            {/* 준비물 */}
                            {selectedPlay.materials && selectedPlay.materials.length > 0 && (
                                <div className="bg-white dark:bg-stone-900 rounded-3xl p-4 border border-stone-200/50 dark:border-stone-800/50">
                                    <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5 mb-2.5">
                                        📦 준비물
                                    </h3>
                                    <div className="flex flex-wrap gap-1.5">
                                        {selectedPlay.materials.map((mat, idx) => (
                                            <span key={idx} className="text-[10px] font-medium text-stone-600 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-2.5 py-1 rounded-lg">
                                                {mat}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 놀이 순서 */}
                            {selectedPlay.process_steps && selectedPlay.process_steps.length > 0 && (
                                <div className="bg-white dark:bg-stone-900 rounded-3xl p-4 border border-stone-200/50 dark:border-stone-800/50">
                                    <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5 mb-3">
                                        🎬 놀이 방법 및 순서
                                    </h3>
                                    <ol className="space-y-3">
                                        {selectedPlay.process_steps.map((step, idx) => (
                                            <li key={idx} className="flex gap-2.5 text-xs text-stone-600 dark:text-stone-300 leading-relaxed items-start">
                                                <span className="w-5 h-5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 font-bold text-[10px]">
                                                    {idx + 1}
                                                </span>
                                                <span className="flex-1 mt-0.5">{step}</span>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            )}

                            {/* 꿀팁 */}
                            {selectedPlay.tips && (
                                <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-3xl p-4 border border-amber-100/50 dark:border-amber-900/30 text-xs">
                                    <h3 className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 mb-2">
                                        💡 더 재미있게 즐기는 꿀팁
                                    </h3>
                                    <p className="text-stone-600 dark:text-stone-300 leading-relaxed pl-1">
                                        {selectedPlay.tips}
                                    </p>
                                </div>
                            )}

                            {/* ================= 감성 이완 툴킷 ================= */}
                            <div className="bg-stone-100/80 dark:bg-stone-900/80 rounded-[28px] p-5 border border-stone-200/60 dark:border-stone-800/60 space-y-4 shadow-inner">
                                <h3 className="text-xs font-black text-amber-800 dark:text-amber-500 tracking-wide uppercase text-center border-b border-stone-200/50 dark:border-stone-800/50 pb-2">
                                    🧘 감성 이완 툴킷
                                </h3>

                                {/* Meditation Timer */}
                                <div className="space-y-2">
                                    <span className="text-[10px] font-bold text-stone-400">⏱️ 명상 및 사색 카운트다운 타이머</span>
                                    <div className="bg-white dark:bg-stone-950 rounded-2xl p-3 border border-stone-200/40 dark:border-stone-900 flex flex-col items-center space-y-3">
                                        {/* Timer Text */}
                                        <div className="text-2xl font-black font-mono text-stone-800 dark:text-stone-100 tracking-wider">
                                            {formatTimerText(timerSeconds)}
                                        </div>
                                        
                                        {/* Preset Buttons */}
                                        <div className="flex gap-1.5 justify-center w-full">
                                            {[180, 300, 600, 900].map((t) => (
                                                <button
                                                    key={t}
                                                    onClick={() => startTimer(t)}
                                                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-stone-100 dark:bg-stone-900 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800 active:scale-95 transition-all"
                                                >
                                                    {t / 60}분
                                                </button>
                                            ))}
                                        </div>

                                        {/* Timer Controls */}
                                        <div className="flex items-center gap-2 w-full pt-1.5 border-t border-stone-100 dark:border-stone-900/50 justify-center">
                                            <Button
                                                onClick={toggleTimerActive}
                                                disabled={timerSeconds === 0}
                                                className={`flex-1 gap-1.5 py-2.5 rounded-xl font-bold text-xs h-auto bg-stone-800 dark:bg-stone-800 hover:bg-stone-700 text-white`}
                                            >
                                                {timerActive ? (
                                                    <>
                                                        <Pause className="w-3.5 h-3.5" />
                                                        일시정지
                                                    </>
                                                ) : (
                                                    <>
                                                        <Play className="w-3.5 h-3.5" />
                                                        타이머 시작
                                                    </>
                                                )}
                                            </Button>
                                            <Button
                                                onClick={resetTimer}
                                                disabled={timerSeconds === 0 && !timerActive}
                                                className="bg-stone-200 hover:bg-stone-300 dark:bg-stone-900 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 p-2.5 rounded-xl h-auto"
                                            >
                                                <RotateCcw className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
