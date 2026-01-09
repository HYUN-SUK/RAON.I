import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { Database } from '@/types/supabase';
import { useWeather, WeatherType } from '@/hooks/useWeather';
import { useLBS } from '@/hooks/useLBS';

type RecommendationItem = Database['public']['Tables']['recommendation_pool']['Row'];
type NearbyEvent = Database['public']['Tables']['nearby_events']['Row'];
type UserProfile = Database['public']['Tables']['profiles']['Row'];

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
    userProfile?: UserProfile | null;
}

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
        },
        userProfile: null
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
    const getGreeting = (time: string, weatherType: WeatherType, nickname?: string) => {
        const name = nickname ? `${nickname}님` : '캠퍼님';

        if (weatherType === 'rainy') return `빗소리와 함께, ${name} ☔`;
        if (weatherType === 'snowy') return `눈 내리는 날, ${name} ❄️`;

        if (time === 'morning') return `상쾌한 아침이에요, ${name} 🌿`;
        if (time === 'afternoon') return `나른한 오후, ${name} 화이팅 ☕`;
        if (time === 'evening') return `맛있는 저녁 되세요, ${name} 🍖`;
        if (time === 'night') return `별이 빛나는 밤, ${name} 🌙`;

        return `반가워요, ${name}`;
    };

    // Derived Context
    const timeCtx = getTimeContext();

    useEffect(() => {
        async function fetchRecommendations() {
            setLoading(true);
            try {
                // 0. Fetch User Profile
                const { data: { user } } = await supabase.auth.getUser();
                let userProfile: UserProfile | null = null;

                if (user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', user.id)
                        .single();
                    userProfile = profile;
                }

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
                    // 2. Score Items with Personalization
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
                                if (weather.type === 'sunny' && timeCtx === 'night') {
                                    if (item.title.includes('별') || item.title.includes('불멍')) score += 50;
                                }
                            }

                            // [Personalization: Family]
                            if (userProfile?.family_type === 'family') {
                                if (tags.age_group === 'kids' || item.title.includes('아이') || item.title.includes('가족')) {
                                    score += 40;
                                }
                            }
                            // [Personalization: Couple]
                            if (userProfile?.family_type === 'couple') {
                                if (item.title.includes('커플') || item.title.includes('2인')) {
                                    score += 30;
                                }
                            }
                        }

                        // [Time - Cooking]
                        if (category === 'cooking') {
                            const time = timeCtx;
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

                            // [Personalization: Interests]
                            if (userProfile?.interests && userProfile.interests.includes('cooking')) {
                                score += 20; // General cooking interest boost
                            }
                        }

                        return { ...item, score };
                    });

                    // 3. Separate & Pick Top 5 -> Random
                    const cookings = scoredItems.filter(i => i.category === 'cooking' && i.score > -50).sort((a, b) => b.score - a.score);
                    const plays = scoredItems.filter(i => i.category === 'play' && i.score > -50).sort((a, b) => b.score - a.score);

                    const topCookings = cookings.slice(0, 50);
                    const topPlays = plays.slice(0, 50);

                    if (topCookings.length > 0) {
                        cookingItem = topCookings[Math.floor(Math.random() * topCookings.length)];
                    } else if (cookings.length > 0) {
                        cookingItem = cookings[Math.floor(Math.random() * cookings.length)];
                    }

                    if (topPlays.length > 0) {
                        playItem = topPlays[Math.floor(Math.random() * topPlays.length)];
                    } else if (plays.length > 0) {
                        playItem = plays[Math.floor(Math.random() * plays.length)];
                    }
                }

                // Reasons based on Context & Profile
                let cookingReason = (timeCtx === 'morning') ? '상쾌한 아침을 여는 메뉴' :
                    (timeCtx === 'evening') ? '캠핑의 꽃, 저녁 바비큐' :
                        (timeCtx === 'night') ? '깊어가는 밤, 감성 야식' : '활력 넘치는 점심 메뉴';

                let playReason = (weather.type === 'rainy') ? '비 오는 날, 텐트 안에서' :
                    (weather.type === 'snowy') ? '눈 내리는 날의 추억' :
                        (timeCtx === 'night') ? '별 헤는 밤, 감성 놀이' : '햇살 좋은 날의 액티비티';

                if (userProfile?.family_type === 'family' && playItem?.tags && (playItem.tags as any).age_group === 'kids') {
                    playReason = "아이들과 함께 즐기는 시간 👨‍👩‍👧‍👦";
                }

                // Fetch Nearby Events from API
                let apiEvents: NearbyEvent[] = [];
                try {
                    const lat = lbs.location?.latitude || 36.67;
                    const lng = lbs.location?.longitude || 126.83;
                    const res = await fetch(`/api/nearby-events?lat=${lat}&lng=${lng}&radius=30000`);
                    if (res.ok) {
                        const result = await res.json();
                        if (result.events && result.events.length > 0) {
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
                    // Silently fallback
                }

                // Update State
                setData({
                    cooking: cookingItem,
                    play: playItem,
                    events: apiEvents,
                    context: {
                        time: timeCtx,
                        weather: weather.type,
                        temp: weather.temp,
                        greeting: getGreeting(timeCtx, weather.type, userProfile?.nickname || undefined)
                    },
                    reasons: {
                        cooking: cookingReason,
                        play: playReason
                    },
                    userProfile
                });

            } catch (error) {
                console.error("Failed to fetch recommendations:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchRecommendations();

    }, [weather.type, refreshTrigger, timeCtx]);

    const shuffle = () => setRefreshTrigger(prev => prev + 1);

    return { data, loading, weather, shuffle };
}
