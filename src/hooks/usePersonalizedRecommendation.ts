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

export function usePersonalizedRecommendation(enabled = true) {
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
        !lbs.usingDefault ? lbs.location.longitude : undefined,
        enabled
    );

    // Helper: Get Time Context
    const getTimeContext = (): 'morning' | 'afternoon' | 'evening' | 'night' => {
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 17) return 'afternoon';
        if (hour >= 17 && hour < 22) return 'evening';
        return 'night';
    };

    // Helper: Get Season
    const getSeason = (): 'spring' | 'summer' | 'autumn' | 'winter' => {
        const month = new Date().getMonth() + 1;
        if (month >= 3 && month <= 5) return 'spring';
        if (month >= 6 && month <= 8) return 'summer';
        if (month >= 9 && month <= 11) return 'autumn';
        return 'winter';
    };

    // Helper: Get Contextual Greeting (날씨/온도/시간/계절 종합 고려 + 문학적 감성 멘트)
    const getGreeting = (time: string, weatherType: WeatherType, nickname?: string, temp?: number | null) => {
        const name = nickname ? `${nickname}님` : '캠퍼님';
        const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
        const season = getSeason();
        const timeCtx = getTimeContext();

        // ═══════════════════════════════════════════════════════════
        // 4️⃣ 기본 시간대 멘트 (계절 정보 없을 때)
        // ═══════════════════════════════════════════════════════════
        if (time === 'morning') {
            return pick([
                `상쾌한 아침이에요, ${name} 🌿`,
                `숲의 아침 공기가 맑아요, ${name} 🌄`,
                `새소리와 함께 일어나셨군요, ${name} 🐦`,
                `좋은 아침이에요, ${name} ☀️`,
                `오늘도 좋은 하루 되세요, ${name} 🌅`,
            ]);
        }
        if (time === 'afternoon') {
            return pick([
                `나른한 오후, 화이팅, ${name} ☕`,
                `햇살 좋은 오후예요, ${name} 🌞`,
                `여유로운 오후 되세요, ${name} 🌤️`,
                `소풍 가기 좋은 날, ${name} 🧺`,
            ]);
        }
        if (time === 'evening') {
            return pick([
                `맛있는 저녁 되세요, ${name} 🍖`,
                `노을이 아름다운 저녁, ${name} 🌅`,
                `캠프파이어 시간이에요, ${name} 🔥`,
                `하루의 마무리, 수고하셨어요, ${name} ✨`,
            ]);
        }
        if (time === 'night') {
            return pick([
                `별이 빛나는 밤, ${name} 🌙`,
                `불멍하기 좋은 밤이에요, ${name} 🔥`,
                `고요한 밤의 여유, ${name} ✨`,
                `별자리 찾아볼까요, ${name}? ⭐`,
                `깊어가는 밤, ${name} 🌌`,
                `오늘 하루도 수고하셨어요, ${name} 💫`,
            ]);
        }

        return `반가워요, ${name} 🌿`;
    };

    // Derived Context
    const timeCtx = getTimeContext();

    useEffect(() => {
        async function fetchRecommendations() {
            setLoading(true);
            try {
                // 0. Parallel Execution: Profile, Pool, Season
                const profilePromise = supabase.auth.getUser().then(async ({ data: { user } }) => {
                    if (user) {
                        return supabase.from('profiles').select('*').eq('id', user.id).single().then(r => r.data);
                    }
                    return null;
                });

                const poolPromise = supabase.from('recommendation_pool').select('*').eq('is_active', true);

                const [userProfile, { data: poolData }] = await Promise.all([profilePromise, poolPromise]);

                // Determine Season
                const month = new Date().getMonth() + 1;
                let currentSeason = 'winter';
                if (month >= 3 && month <= 5) currentSeason = 'spring';
                else if (month >= 6 && month <= 8) currentSeason = 'summer';
                else if (month >= 9 && month <= 11) currentSeason = 'autumn';

                let cookingItem: RecommendationItem | null = null;
                let playItem: RecommendationItem | null = null;
                let cookingRationale = '';

                // 2. Score Items with Personalization - Only for Play (Cooking moved to Server Action)
                if (poolData) {
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

                        return { ...item, score };
                    });

                    // 3. Separate & Pick Top 5 -> Random
                    // Cooking is now loaded via Server Action
                    const plays = scoredItems.filter(i => i.category === 'play' && i.score > -50).sort((a, b) => b.score - a.score);
                    const topPlays = plays.slice(0, 50);

                    if (topPlays.length > 0) {
                        playItem = topPlays[Math.floor(Math.random() * topPlays.length)];
                    } else if (plays.length > 0) {
                        playItem = plays[Math.floor(Math.random() * plays.length)];
                    }
                }

                // 4. Fetch Cooking via Server Action (New V9 Logic)
                const { getPersonalizedRecommendations } = await import('@/actions/recommendation');
                // Use default coordinates if LBS failed
                const targetLat = lbs.location?.latitude || 36.5;
                const targetLng = lbs.location?.longitude || 127.5;

                const { recommendations: cookingRecs, rationale } = await getPersonalizedRecommendations(1, {
                    lat: targetLat,
                    lng: targetLng,
                    // Pass approximate date or rely on server time
                    // dateStr: new Date().toISOString().split('T')[0] 
                });

                cookingRationale = rationale;

                if (cookingRecs && cookingRecs.length > 0) {
                    // Map back to RecommendationItem shape loosely
                    const rec = cookingRecs[0];
                    cookingItem = {
                        ...rec,
                        // Fill missing fields from poolData if needed, 
                        // or just use what we have. The UI handles both.
                        // We need to find the full object from poolData to be safe for types
                        ...poolData?.find(p => p.id === rec.id)
                    } as RecommendationItem;
                }

                // Reasons based on Context & Profile
                let playReason = (weather.type === 'rainy') ? '비 오는 날, 텐트 안에서' :
                    (weather.type === 'snowy') ? '눈 내리는 날의 추억' :
                        (timeCtx === 'night') ? '별 헤는 밤, 감성 놀이' : '햇살 좋은 날의 액티비티';

                if (userProfile?.family_type === 'family' && playItem?.tags && (playItem.tags as any).age_group === 'kids') {
                    playReason = "아이들과 함께 즐기는 시간 👨‍👩‍👧‍👦";
                }

                // Update Main Data (Without Events yet)
                setData(prev => ({
                    ...prev,
                    cooking: cookingItem,
                    play: playItem,
                    context: {
                        time: timeCtx,
                        weather: weather.type,
                        temp: weather.temp,
                        greeting: getGreeting(timeCtx, weather.type, userProfile?.nickname || undefined, weather.temp)
                    },
                    reasons: {
                        cooking: cookingRationale, // Use the server-generated rationale
                        play: playReason
                    },
                    userProfile
                }));

                // IMPORTANT: Release Loading Here - Hero and Main Cards are ready
                setLoading(false);

                // Fetch Nearby Events from API - Disabled to prevent API quota usage
                /*
                const lat = lbs.location?.latitude || 36.67;
                const lng = lbs.location?.longitude || 126.83;

                fetch(`/api/nearby-events?lat=${lat}&lng=${lng}&radius=30000`)
                    .then(res => res.json())
                    .then(result => {
                        if (result.events && result.events.length > 0) {
                            const apiEvents = result.events.slice(0, 3).map((e: any) => ({
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

                            // Silent Update
                            setData(prev => ({ ...prev, events: apiEvents }));
                        }
                    })
                    .catch(err => console.warn("Background nearby fetch failed", err));
                */

            } catch (error) {
                console.error("Failed to fetch recommendations:", error);
                setLoading(false);
            }
        }

        fetchRecommendations();

        // 의존성에서 weather.type 제거 - 날씨 로딩 기다리지 않고 먼저 추천 표시
        // 날씨 정보는 greeting에서만 사용하며, 날씨 도착 시 별도 업데이트
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshTrigger, timeCtx]);

    const shuffle = () => setRefreshTrigger(prev => prev + 1);

    // 날씨 로딩 완료 시 context/greeting 업데이트 (기존 추천은 유지)
    useEffect(() => {
        if (!weather.loading && weather.type !== 'unknown') {
            setData(prev => ({
                ...prev,
                context: {
                    ...prev.context,
                    weather: weather.type,
                    temp: weather.temp,
                    greeting: getGreeting(timeCtx, weather.type, prev.userProfile?.nickname || undefined, weather.temp)
                }
            }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weather.loading, weather.type, weather.temp]);

    return { data, loading, weather, shuffle };
}
