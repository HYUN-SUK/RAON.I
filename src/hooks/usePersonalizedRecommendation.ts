import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { Database } from '@/types/supabase';

type RecommendationItem = Database['public']['Tables']['recommendation_pool']['Row'];
type NearbyEvent = Database['public']['Tables']['nearby_events']['Row'];

interface PersonalizedData {
    cooking: RecommendationItem | null;
    play: RecommendationItem | null;
    event: NearbyEvent | null;
}

export function usePersonalizedRecommendation() {
    const [data, setData] = useState<PersonalizedData>({ cooking: null, play: null, event: null });
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        async function fetchRecommendations() {
            try {
                // 1. Determine Season
                const month = new Date().getMonth() + 1;
                let currentSeason = 'winter'; // Default
                if (month >= 3 && month <= 5) currentSeason = 'spring';
                else if (month >= 6 && month <= 8) currentSeason = 'summer';
                else if (month >= 9 && month <= 11) currentSeason = 'autumn';

                // 2. Fetch Pool (Cooking & Play)
                // In a real app, we might filter by database query, but for now fetch active and filter in JS for random selection
                const { data: poolData } = await supabase
                    .from('recommendation_pool')
                    .select('*')
                    .eq('is_active', true);

                let cookingItem: RecommendationItem | null = null;
                let playItem: RecommendationItem | null = null;

                if (poolData) {
                    // Filter by Season (if tags contain season or if tags is empty)
                    // Logic: If tags['season'] exists, it must include currentSeason. If no season tag, it's all-season.
                    const seasonFiltered = poolData.filter(item => {
                        const tags = item.tags as any;
                        if (!tags?.season || tags.season.length === 0) return true;
                        return tags.season.includes(currentSeason);
                    });

                    const cookings = seasonFiltered.filter(i => i.category === 'cooking');
                    const plays = seasonFiltered.filter(i => i.category === 'play');

                    if (cookings.length > 0) {
                        cookingItem = cookings[Math.floor(Math.random() * cookings.length)];
                    }

                    /* 
                    // TEMP: Force Inject V2 Data for Verification (Uncomment to test V2 UI without DB)
                    if (!cookingItem) {
                        cookingItem = {
                            id: 'mock-cook-v2',
                            title: '오늘의 셰프 (매운탕)',
                            description: '얼큰하고 시원한 매운탕 끓이기 도전!',
                            icon: '🍲',
                            category: 'cooking',
                            bgColorClass: 'bg-orange-100',
                            actionLabel: '요리 시작하기',
                            actionLink: '/cooking/1',
                            data: {}
                        } as any;
                    }

                    if (cookingItem) {
                        (cookingItem as any).difficulty = 2;
                        (cookingItem as any).time_required = 40;
                        (cookingItem as any).data = {
                            difficulty: 2,
                            time_required: 40,
                            ingredients: [
                                { name: "삼겹살", amount: "300g" },
                                "김치 반포기",
                                "두부 한 모",
                                "대파 1대"
                            ],
                            process_steps: [
                                "달궈진 냄비에 삼겹살을 볶아주세요.",
                                "김치를 넣고 함께 볶다가 물을 부어주세요.",
                                "팔팔 끓으면 두부와 대파를 넣고 5분간 더 끓입니다."
                            ],
                            tips: "쌀뜨물을 사용하면 국물 맛이 더 깊어집니다!"
                        };
                    }
                    */

                    if (plays.length > 0) playItem = plays[Math.floor(Math.random() * plays.length)];
                }

                // 3. Fetch Nearby Event (Active and current date)
                const today = new Date().toISOString().split('T')[0];
                const { data: events } = await supabase
                    .from('nearby_events')
                    .select('*')
                    .eq('is_active', true)
                    .gte('end_date', today) // Event not ended yet
                    .order('start_date', { ascending: true })
                    .limit(1);

                const eventItem = events && events.length > 0 ? events[0] : null;

                setData({ cooking: cookingItem, play: playItem, event: eventItem });

            } catch (error) {
                console.error("Failed to fetch recommendations:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchRecommendations();
    }, []);

    return { data, loading };
}
