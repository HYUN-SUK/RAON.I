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

        // ═══════════════════════════════════════════════════════════
        // 1️⃣ 극한 온도 (가장 우선) - 안전/건강 관련
        // ═══════════════════════════════════════════════════════════
        if (temp !== null && temp !== undefined) {
            // 혹한 (영하 10도 이하)
            if (temp <= -10) {
                return pick([
                    `${name}, 온기를 나눠요 🔥`,
                    `추운 밤, 따뜻한 차 한잔 어떠세요, ${name}? ☕`,
                    `겨울의 끝에서 봄을 기다려요, ${name} ❄️`,
                    `${name}, 오늘은 따뜻한 국물이 그리운 날 🍲`,
                    `몸 녹이며 쉬어가세요, ${name} 🧣`,
                ]);
            }
            // 매우 추움 (영하 ~ 영하 10도)
            if (temp < 0) {
                if (time === 'night') {
                    return pick([
                        `얼어붙은 밤하늘에 별이 더 맑아요, ${name} ✨`,
                        `추운 밤, 불멍의 온기가 그립죠, ${name} 🔥`,
                        `겨울밤의 고요함 속으로, ${name} 🌙`,
                        `한파 속에서도 빛나는 밤, ${name} ⭐`,
                        `${name}, 따뜻한 텐트에서 달콤한 꿈을 💤`,
                    ]);
                }
                if (time === 'morning') {
                    return pick([
                        `서리 내린 아침, ${name} 🌨️`,
                        `입김이 피어오르는 새벽이에요, ${name} ❄️`,
                        `추운 아침, 따뜻한 커피 한잔 어때요, ${name}? ☕`,
                        `겨울 아침의 상쾌함을 느껴보세요, ${name} 🌅`,
                        `얼어붙은 풀잎에도 아침 해가 반짝여요, ${name} ✨`,
                    ]);
                }
                return pick([
                    `따뜻하게 챙겨 입으셨죠, ${name}? 🧤`,
                    `불멍하기 딱 좋은 날씨예요, ${name} 🔥`,
                    `겨울 캠핑의 진수를 느껴보세요, ${name} ⛄`,
                    `추위 속에서도 낭만은 피어나죠, ${name} 💫`,
                    `${name}, 핫초코 타임 어떠세요? ☕`,
                ]);
            }
            // 쌀쌀함 (0~10도)
            if (temp < 10) {
                if (season === 'winter') {
                    return pick([
                        `겨울 숲의 고요함 속으로, ${name} 🌲`,
                        `차가운 공기가 맑은 날이에요, ${name} ❄️`,
                        `${name}, 따뜻한 담요 챙기셨죠? 🧣`,
                        `겨울의 정취를 만끽하세요, ${name} ⛄`,
                    ]);
                }
                if (season === 'spring') {
                    return pick([
                        `이른 봄 아침, 아직 쌀쌀하죠, ${name} 🌸`,
                        `봄바람이 살랑이는 날, ${name} 🍃`,
                        `새싹이 돋아나는 계절이에요, ${name} 🌱`,
                    ]);
                }
                if (season === 'autumn') {
                    return pick([
                        `가을 끝자락의 서늘함, ${name} 🍂`,
                        `단풍 사이로 부는 바람이 차갑죠, ${name} 🍁`,
                        `${name}, 따뜻한 차 한잔 어떠세요? ☕`,
                    ]);
                }
            }
            // 무더위 (30도 이상)
            if (temp >= 30) {
                return pick([
                    `${name}, 시원한 그늘에서 쉬어가세요 🌳`,
                    `뜨거운 여름, 계곡이 그립죠, ${name} 💦`,
                    `더위를 피해 숲 속으로, ${name} 🌲`,
                    `수박 한 조각 어떠세요, ${name}? 🍉`,
                    `물놀이하기 딱 좋은 날이에요, ${name} 🏊`,
                    `아이스 아메리카노가 필요한 온도, ${name} ☕`,
                ]);
            }
            // 더움 (25~30도)
            if (temp >= 25) {
                return pick([
                    `햇살 따뜻한 날이에요, ${name} ☀️`,
                    `여름의 열기가 느껴지네요, ${name} 🌞`,
                    `${name}, 시원한 음료 챙기셨죠? 🧊`,
                    `숲 그늘 아래가 좋은 날, ${name} 🌳`,
                ]);
            }
        }

        // ═══════════════════════════════════════════════════════════
        // 2️⃣ 특별 날씨 (비/눈/흐림) + 시간대/계절 조합
        // ═══════════════════════════════════════════════════════════
        if (weatherType === 'rainy') {
            if (time === 'night') {
                return pick([
                    `빗소리를 자장가 삼아, ${name} 🌧️`,
                    `비 내리는 밤, 텐트 안이 아늑해요, ${name} ☔`,
                    `빗방울이 연주하는 밤이에요, ${name} 🎵`,
                    `촉촉한 밤공기가 감싸는 시간, ${name} 🌙`,
                    `비 오는 밤의 낭만 속으로, ${name} ☂️`,
                ]);
            }
            if (time === 'morning') {
                return pick([
                    `빗방울에 씻긴 싱그러운 아침, ${name} 🌿`,
                    `비 갠 숲의 향기가 깊어요, ${name} 🌧️`,
                    `촉촉한 아침이에요, ${name} ☔`,
                    `비 오는 아침, 커피 향이 더 진해요, ${name} ☕`,
                ]);
            }
            return pick([
                `빗소리와 함께하는 오후, ${name} ☔`,
                `비 오는 숲의 고요함, ${name} 🌧️`,
                `촉촉한 대지의 향기를 느껴보세요, ${name} 🌿`,
                `빗소리가 배경음악인 날, ${name} 🎵`,
            ]);
        }
        if (weatherType === 'snowy') {
            if (time === 'night') {
                return pick([
                    `눈 내리는 밤, 세상이 조용해요, ${name} ❄️`,
                    `하얀 눈이 덮은 밤의 정적, ${name} 🌨️`,
                    `눈꽃이 춤추는 밤이에요, ${name} ⛄`,
                    `소복소복 쌓이는 추억, ${name} ✨`,
                ]);
            }
            if (time === 'morning') {
                return pick([
                    `눈 덮인 세상이 반짝이는 아침, ${name} ❄️`,
                    `하얀 아침이 찾아왔어요, ${name} ⛄`,
                    `첫눈처럼 설레는 아침, ${name} 🌨️`,
                    `동화 속 풍경 같은 아침이에요, ${name} ✨`,
                ]);
            }
            return pick([
                `눈 내리는 풍경이 아름다워요, ${name} ❄️`,
                `하얀 세상 속으로 떠나볼까요, ${name} ⛄`,
                `눈 오는 날의 설렘, ${name} 🌨️`,
            ]);
        }
        if (weatherType === 'cloudy') {
            if (time === 'night') {
                return pick([
                    `구름 사이로 달이 숨바꼭질해요, ${name} 🌙`,
                    `몽환적인 밤하늘이에요, ${name} ☁️`,
                    `흐린 밤에도 감성은 맑아요, ${name} ✨`,
                ]);
            }
            return pick([
                `구름 낀 하늘도 운치 있죠, ${name} ☁️`,
                `흐린 날의 여유를 즐겨보세요, ${name} 🌫️`,
                `햇살 대신 부드러운 바람이 좋은 날, ${name} 🍃`,
                `은은한 하늘빛이 좋은 날이에요, ${name} ☁️`,
            ]);
        }

        // ═══════════════════════════════════════════════════════════
        // 3️⃣ 계절 + 시간대 조합 (맑은 날)
        // ═══════════════════════════════════════════════════════════

        // 🌸 봄
        if (season === 'spring') {
            if (time === 'morning') {
                return pick([
                    `봄 아침, 새싹이 인사해요, ${name} 🌱`,
                    `꽃향기 가득한 아침이에요, ${name} 🌸`,
                    `봄바람에 실려 오는 설렘, ${name} 🍃`,
                    `상쾌한 봄 아침이에요, ${name} 🌷`,
                    `새소리가 봄을 노래해요, ${name} 🐦`,
                ]);
            }
            if (time === 'afternoon') {
                return pick([
                    `봄볕 아래 나른한 오후, ${name} 🌞`,
                    `꽃구경 가기 좋은 날이에요, ${name} 🌸`,
                    `봄바람이 살랑이는 오후, ${name} 🍃`,
                    `피크닉 떠나기 딱 좋은 날, ${name} 🧺`,
                ]);
            }
            if (time === 'evening') {
                return pick([
                    `봄 저녁, 노을이 분홍빛이에요, ${name} 🌅`,
                    `꽃잎이 흩날리는 저녁, ${name} 🌸`,
                    `따스한 봄 저녁이에요, ${name} ✨`,
                ]);
            }
            return pick([
                `봄밤의 고요함 속으로, ${name} 🌙`,
                `꽃향기 은은한 밤이에요, ${name} 🌸`,
                `별과 꽃이 함께하는 밤, ${name} ⭐`,
            ]);
        }

        // ☀️ 여름
        if (season === 'summer') {
            if (time === 'morning') {
                return pick([
                    `여름 아침, 매미 소리가 들려와요, ${name} 🌿`,
                    `싱그러운 여름 아침이에요, ${name} ☀️`,
                    `초록이 눈부신 아침, ${name} 🌲`,
                    `이슬 맺힌 풀잎이 반짝이는 아침, ${name} ✨`,
                ]);
            }
            if (time === 'afternoon') {
                return pick([
                    `한여름 오후의 열기, ${name} ☀️`,
                    `그늘 아래서 쉬어가세요, ${name} 🌳`,
                    `시원한 물놀이가 그리운 오후, ${name} 💦`,
                    `나무 그늘이 소중한 시간, ${name} 🌲`,
                ]);
            }
            if (time === 'evening') {
                return pick([
                    `여름 저녁, 시원한 바람이 불어와요, ${name} 🌅`,
                    `해질녘이 가장 아름다운 계절, ${name} ✨`,
                    `바비큐 향이 퍼지는 저녁, ${name} 🍖`,
                ]);
            }
            return pick([
                `여름밤의 별이 쏟아져요, ${name} 🌌`,
                `반딧불이 춤추는 밤, ${name} ✨`,
                `시원한 바람이 부는 밤이에요, ${name} 🌙`,
                `여름밤의 정취에 빠져보세요, ${name} ⭐`,
            ]);
        }

        // 🍂 가을
        if (season === 'autumn') {
            if (time === 'morning') {
                return pick([
                    `가을 아침, 단풍이 물들어가요, ${name} 🍂`,
                    `선선한 가을 아침이에요, ${name} 🍁`,
                    `낙엽 밟는 소리가 좋은 아침, ${name} 🌅`,
                    `가을빛이 황금인 아침, ${name} ✨`,
                ]);
            }
            if (time === 'afternoon') {
                return pick([
                    `독서하기 좋은 가을 오후, ${name} 📖`,
                    `단풍 구경 가기 좋은 날이에요, ${name} 🍁`,
                    `하늘이 높고 푸른 오후, ${name} 🌤️`,
                    `쓸쓸하면서도 아름다운 오후, ${name} 🍂`,
                ]);
            }
            if (time === 'evening') {
                return pick([
                    `가을 저녁, 노을이 깊어요, ${name} 🌅`,
                    `따뜻한 국물이 생각나는 저녁, ${name} 🍲`,
                    `캠프파이어가 어울리는 저녁, ${name} 🔥`,
                ]);
            }
            return pick([
                `가을밤의 달이 유난히 밝아요, ${name} 🌕`,
                `낙엽 향기 가득한 밤, ${name} 🍂`,
                `쓸쓸하지만 아름다운 가을밤, ${name} 🌙`,
                `별이 더 선명한 가을밤이에요, ${name} ⭐`,
            ]);
        }

        // ❄️ 겨울
        if (season === 'winter') {
            if (time === 'morning') {
                return pick([
                    `겨울 아침, 입김이 피어올라요, ${name} ❄️`,
                    `차가운 공기가 맑은 아침, ${name} 🌅`,
                    `담요 밖이 추운 아침이에요, ${name} 🧣`,
                    `겨울 숲의 고요한 아침, ${name} 🌲`,
                ]);
            }
            if (time === 'afternoon') {
                return pick([
                    `따스한 햇살이 귀한 겨울 오후, ${name} ☀️`,
                    `핫초코가 생각나는 오후예요, ${name} ☕`,
                    `겨울 산책하기 좋은 날, ${name} 🌲`,
                ]);
            }
            if (time === 'evening') {
                return pick([
                    `겨울 저녁, 따뜻한 불이 그리워요, ${name} 🔥`,
                    `어둠이 빨리 찾아오는 저녁, ${name} 🌅`,
                    `뜨끈한 국물이 최고인 저녁, ${name} 🍲`,
                ]);
            }
            return pick([
                `겨울밤, 별이 유리처럼 맑아요, ${name} ⭐`,
                `불멍의 온기가 퍼지는 밤, ${name} 🔥`,
                `추운 밤, 따뜻한 마음으로, ${name} ❤️`,
                `고요한 겨울밤이에요, ${name} 🌙`,
                `겨울 밤하늘이 청명해요, ${name} ✨`,
            ]);
        }

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
                        greeting: getGreeting(timeCtx, weather.type, userProfile?.nickname || undefined, weather.temp)
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
