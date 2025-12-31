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

    // 2. LBS & Weather Hooks
    // Use LBS explicitly to pass location to Weather
    const lbs = useLBS();
    // Pass user location if available (not using default/loading state)
    // If LBS is loading or using default, pass undefined to let useWeather use its default/cache logic 
    // BUT since we normalized defaults, we can just pass specific coords if not default
    const weather = useWeather(
        !lbs.usingDefault ? lbs.location.latitude : undefined,
        !lbs.usingDefault ? lbs.location.longitude : undefined
    );

    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    // Helper: Get Time Context
    const getTimeContext = () => {
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 17) return 'afternoon';
        if (hour >= 17 && hour < 22) return 'evening';
        return 'night';
    };

    // Helper: Get Contextual Greeting
    const getGreeting = (time: string, weatherType: WeatherType) => {
        // 1. Special Weather Greetings
        if (weatherType === 'rainy') return '빗소리와 함께하는 우중캠핑 ☔';
        if (weatherType === 'snowy') return '눈 내리는 날의 낭만 ❄️';
        if (weatherType === 'sunny' && time === 'afternoon') return '햇살 좋은 오후네요 ☀️';

        // 2. Time Greetings
        if (time === 'morning') return '상쾌한 아침 시작하세요 🌿';
        if (time === 'afternoon') return '나른한 오후, 활력이 필요해요 ☕';
        if (time === 'evening') return '맛있는 저녁 식사 하셨나요? 🍖';
        if (time === 'night') return '별 보기 좋은 고요한 밤 🌙';

        return '반가워요, 캠퍼님';
    };

    useEffect(() => {
        async function fetchRecommendations() {
            try {
                // Determine Season
                const month = new Date().getMonth() + 1;
                let currentSeason = 'winter';
                if (month >= 3 && month <= 5) currentSeason = 'spring';
                else if (month >= 6 && month <= 8) currentSeason = 'summer';
                else if (month >= 9 && month <= 11) currentSeason = 'autumn';

                // Fetch Pool
                const { data: poolData } = await supabase
                    .from('recommendation_pool')
                    .select('*')
                    .eq('is_active', true);

                let cookingItem: RecommendationItem | null = null;
                let playItem: RecommendationItem | null = null;

                if (poolData) {
                    const seasonFiltered = poolData.filter(item => {
                        const tags = item.tags as unknown as TagData; // Safe cast to interface
                        if (!tags?.season || tags.season.length === 0) return true;
                        return tags.season.includes(currentSeason);
                    });

                    const cookings = seasonFiltered.filter(i => i.category === 'cooking');
                    const plays = seasonFiltered.filter(i => i.category === 'play');

                    if (cookings.length > 0) cookingItem = cookings[Math.floor(Math.random() * cookings.length)];
                    if (plays.length > 0) playItem = plays[Math.floor(Math.random() * plays.length)];
                }

                // Fetch Nearby Event
                const today = new Date().toISOString().split('T')[0];
                const { data: events } = await supabase
                    .from('nearby_events')
                    .select('*')
                    .eq('is_active', true)
                    .gte('end_date', today)
                    .order('start_date', { ascending: true })
                    .limit(1);

                // Context Calculation
                const timeCtx = getTimeContext();
                const greetingMsg = getGreeting(timeCtx, weather.type);

                setData({
                    cooking: cookingItem,
                    play: playItem,
                    events: events || [],
                    context: {
                        time: timeCtx,
                        weather: weather.type,
                        temp: weather.temp,
                        greeting: greetingMsg
                    }
                });

            } catch (error) {
                // console.error("Failed to fetch recommendations:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchRecommendations();
    }, [weather.type]); // Re-run when weather type changes (after hook fetch)

    return { data, loading };
}
