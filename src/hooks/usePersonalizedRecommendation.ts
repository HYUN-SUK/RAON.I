import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { Database } from '@/types/supabase';
import { useWeather, WeatherType } from '@/hooks/useWeather';

type RecommendationItem = Database['public']['Tables']['recommendation_pool']['Row'];
type NearbyEvent = Database['public']['Tables']['nearby_events']['Row'];

interface PersonalizedData {
    cooking: RecommendationItem | null;
    play: RecommendationItem | null;
    events: NearbyEvent[];
    context: {
        time: 'morning' | 'afternoon' | 'evening' | 'night';
        weather: WeatherType;
        temp: number | null;
        greeting: string;
    };
    reasons?: {
        cooking: string;
        play: string;
    };
}

import { useLBS } from '@/hooks/useLBS';

interface TagData {
    season?: string[];
    [key: string]: any;
}

export function usePersonalizedRecommendation() {
    // 1. Initial State
    const [data, setData] = useState<PersonalizedData>({
        cooking: null,
        play: null,
        events: [],
        context: {
            time: 'morning',
            weather: 'unknown',
            temp: null,
            greeting: '반가워요, 캠퍼님'
        }
    });

    const [loading, setLoading] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const supabase = createClient();

    // 2. LBS & Weather Hooks
    const lbs = useLBS();
    const weather = useWeather(
        !lbs.usingDefault ? lbs.location.latitude : undefined,
        !lbs.usingDefault ? lbs.location.longitude : undefined
    );

    // Helper: Get Time Context
    const getTimeContext = (): 'morning' | 'afternoon' | 'evening' | 'night' => {
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 17) return 'afternoon';
        if (hour >= 17 && hour < 22) return 'evening';
        return 'night';
    };

    // Helper: Get Contextual Greeting
    const getGreeting = (time: string, weatherType: WeatherType) => {
        if (weatherType === 'rainy') return '빗소리와 함께하는 우중캠핑 ☔';
        if (weatherType === 'snowy') return '눈 내리는 날의 낭만 ❄️';
        if (weatherType === 'sunny' && time === 'afternoon') return '햇살 좋은 오후네요 ☀️';

        if (time === 'morning') return '상쾌한 아침 시작하세요 🌿';
        if (time === 'afternoon') return '나른한 오후, 활력이 필요해요 ☕';
        if (time === 'evening') return '맛있는 저녁 식사 하셨나요? 🍖';
        if (time === 'night') return '별 보기 좋은 고요한 밤 🌙';

        return '반가워요, 캠퍼님';
    };

    // Derived Context (calculated on every render to ensure freshness)
    const timeCtx = getTimeContext();
    const context = {
        time: timeCtx,
        weather: weather.type,
        temp: weather.temp,
        greeting: getGreeting(timeCtx, weather.type)
    };

    useEffect(() => {
        async function fetchRecommendations() {
            setLoading(true);
            try {
                // Determine Season
                const month = new Date().getMonth() + 1;
                let currentSeason = 'winter';
                if (month >= 3 && month <= 5) currentSeason = 'spring';
                else if (month >= 6 && month <= 8) currentSeason = 'summer';
                else if (month >= 9 && month <= 11) currentSeason = 'autumn';

                // 1. Fetch Pool
                const { data: poolData } = await supabase
                    .from('recommendation_pool')
                    .select('*')
                    .eq('is_active', true);

                let cookingItem: RecommendationItem | null = null;
                let playItem: RecommendationItem | null = null;

                if (poolData) {
                    // 2. Score Items
                    const scoredItems = poolData.map(item => {
                        let score = 0;
                        const tags = item.tags as unknown as TagData || {};
                        const category = item.category;

                        // [Season Scoring]
                        if (tags.season && tags.season.length > 0) {
                            if (tags.season.includes(currentSeason)) score += 50;
                            else score -= 100;
                        } else {
                            score += 10;
                        }

                        // [Weather Scoring]
                        const isRainyOrSnowy = weather.type === 'rainy' || weather.type === 'snowy';
                        const isSunny = weather.type === 'sunny';

                        // Play Logic
                        if (category === 'play') {
                            const isIndoor = tags.location_type === '실내' || tags.location_type === '텐트';
                            const isOutdoor = tags.location_type === '실외' || !tags.location_type;

                            if (isRainyOrSnowy) {
                                if (isIndoor) score += 40;
                                if (isOutdoor) score -= 50;
                            } else if (isSunny) {
                                if (isOutdoor) score += 30;
                                if (weather.type === 'sunny' && context.time === 'night') {
                                    if (item.title.includes('별') || item.title.includes('불멍')) score += 50;
                                }
                            }
                        }

                        // [Time - Cooking]
                        if (category === 'cooking') {
                            const time = context.time;
                            const title = item.title.toLowerCase();
                            const desc = item.description?.toLowerCase() || '';
                            const combined = title + " " + desc;

                            if (time === 'morning') {
                                if (combined.includes('브런치') || combined.includes('커피') || combined.includes('빵') || combined.includes('죽')) score += 30;
                                if (combined.includes('바비큐') || combined.includes('소주')) score -= 20;
                            } else if (time === 'evening') {
                                if (combined.includes('바비큐') || combined.includes('구이') || combined.includes('전골') || combined.includes('찌개')) score += 40;
                            } else if (time === 'night') {
                                if (combined.includes('안주') || combined.includes('꼬치') || combined.includes('어묵')) score += 40;
                                if (combined.includes('가벼운') || combined.includes('간단')) score += 20;
                            }
                        }

                        return { ...item, score };
                    });

                    // 3. Separate & Pick Top 5 -> Random
                    const cookings = scoredItems.filter(i => i.category === 'cooking' && i.score > -50).sort((a, b) => b.score - a.score);
                    const plays = scoredItems.filter(i => i.category === 'play' && i.score > -50).sort((a, b) => b.score - a.score);
                    // Final Selection with Reason
                    const topCookings = cookings.slice(0, 5);
                    const topPlays = plays.slice(0, 5);

                    if (topCookings.length > 0) {
                        const selected = topCookings[Math.floor(Math.random() * topCookings.length)];
                        cookingItem = selected;
                    } else if (cookings.length > 0) {
                        cookingItem = cookings[Math.floor(Math.random() * cookings.length)];
                    }

                    if (topPlays.length > 0) {
                        const selected = topPlays[Math.floor(Math.random() * topPlays.length)];
                        playItem = selected;
                    } else if (plays.length > 0) {
                        playItem = plays[Math.floor(Math.random() * plays.length)];
                    }
                }

                // Reasons based on Context
                const cookingReason = (context.time === 'morning') ? '상쾌한 아침을 여는 메뉴' :
                    (context.time === 'evening') ? '캠핑의 꽃, 저녁 바비큐' :
                        (context.time === 'night') ? '깊어가는 밤, 감성 야식' : '활력 넘치는 점심 메뉴';

                const playReason = (weather.type === 'rainy') ? '비 오는 날, 텐트 안에서' :
                    (weather.type === 'snowy') ? '눈 내리는 날의 추억' :
                        (context.time === 'night') ? '별 헤는 밤, 감성 놀이' : '햇살 좋은 날의 액티비티';

                // Fetch Nearby Events from API (not DB) for consistency with NearbyDetailSheet
                let apiEvents: NearbyEvent[] = [];
                try {
                    const lat = lbs.location?.latitude || 36.67;
                    const lng = lbs.location?.longitude || 126.83;
                    const res = await fetch(`/api/nearby-events?lat=${lat}&lng=${lng}&radius=20000`);
                    if (res.ok) {
                        const result = await res.json();
                        if (result.events && result.events.length > 0) {
                            // Map API response to NearbyEvent type
                            apiEvents = result.events.slice(0, 3).map((e: any) => ({
                                id: e.id || 0,
                                title: e.title,
                                description: e.description,
                                location: e.location,
                                start_date: e.start_date,
                                end_date: e.end_date,
                                image_url: e.image_url,
                                latitude: e.latitude,
                                longitude: e.longitude,
                                is_active: true,
                                created_at: new Date().toISOString(),
                            }));
                        }
                    }
                } catch {
                    // Silently fallback to empty
                }

                // Update State
                setData({
                    cooking: cookingItem,
                    play: playItem,
                    events: apiEvents,
                    context: {
                        ...context,
                        greeting: getGreeting(context.time, weather.type)
                    },
                    reasons: {
                        cooking: cookingReason,
                        play: playReason
                    }
                });

            } catch (error) {
                console.error("Failed to fetch recommendations:", error);
            } finally {
                setLoading(false);
            }
        }

        // Trigger fetch
        fetchRecommendations();

    }, [weather.type, refreshTrigger, context.time]);

    const shuffle = () => setRefreshTrigger(prev => prev + 1);

    return { data, loading, weather, shuffle };
}
