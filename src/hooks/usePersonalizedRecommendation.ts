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

// Helper: Get Contextual Greeting (날씨 독립형 104종 조합 감성 멘트 엔진)
const getGreeting = (nickname?: string) => {
    const name = nickname ? `${nickname}` : '캠퍼';
    const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
    const season = getSeason();
    const timeCtx = getTimeContext();

    // 1단계. 오프닝 데코레이터 (10종)
    const openings = [
        `${name}님, `,
        `반가워요, ${name}님! `,
        `오늘도 찾아와 주셨군요, ${name}님. `,
        `기분 좋은 하루의 시작을 함께하는 ${name}님, `,
        `라온아이와 함께 마음을 뉘어볼까요, ${name}님? `,
        `바람이 머무는 곳으로 찾아오신 ${name}님, `,
        `따뜻한 초록 쉼표가 필요한 ${name}님, `,
        `소중한 일상 속 한 조각 여유를 찾으러 오신 ${name}님, `,
        `어제보다 한층 편안한 오늘을 맞이한 ${name}님, `,
        `숲속의 고요함을 닮은 편안함을 전하며, ${name}님, `,
    ];

    // 2단계. 조건별 감성 본문 풀 (총 94종)
    const rand = Math.random();
    let body = "";

    if (rand < 0.25) {
        // A. 월별 스페셜 본문 (12달 * 3개 = 36종) - 25% 확률
        const month = new Date().getMonth() + 1;
        const monthGreetings: Record<number, string[]> = {
            1: [
                "새해의 첫 페이지가 열리는 1월, 새로운 캠핑 버킷리스트를 채우며 설레게 시작해봐요.",
                "차가운 공기 속에서도 따뜻한 희망이 싹트는 1월, 올해의 첫 여정을 마음속으로 그려볼까요?",
                "차분히 내려앉은 고요함 속에서 1월의 아늑한 시작을 함께 나누고 싶어요."
            ],
            2: [
                "긴 겨울의 끝자락 2월, 다가올 봄의 따스함을 기다리며 마음을 온기로 가득 채워보세요.",
                "계절이 바뀌는 길목에 선 2월, 움츠렸던 몸과 마음에 작은 온기를 불어넣어 줄 시간이에요.",
                "막바지 추위 속에서 피어나는 아늑함처럼, 2월의 소박한 여유를 편안히 즐겨보세요."
            ],
            3: [
                "대지에 봄기운이 서서히 퍼지는 3월, 새로운 계절의 설렘을 맞이할 준비를 해볼까요?",
                "얼었던 흙이 부드럽게 녹아내리는 3월, 싱그러운 봄의 첫 기운을 가만히 느껴보세요.",
                "봄이 속삭이는 듯한 3월, 새로운 여정과 함께 내 마음에도 파릇파릇한 생기를 더해봐요."
            ],
            4: [
                "온 세상이 화사한 꽃소식으로 가득한 4월, 내 마음에도 싱그러운 봄바람이 부는 하루가 되길 바라요.",
                "꽃봉오리가 수줍게 터지는 4월, 일상에도 화사한 꽃잎 같은 평화로움이 가득하길 기대해요.",
                "어디선가 봄꽃 향기가 불어오는 4월, 가만히 눈을 감고 포근한 계절의 숨결을 느껴보세요."
            ],
            5: [
                "푸르른 신록이 마음을 정화해주는 5월, 소중한 사람들과 따뜻한 마음을 나누는 달입니다.",
                "가장 싱그럽고 눈부신 초록의 5월, 숲 그늘 아래서 나누는 작은 대화처럼 편안한 하루 보내세요.",
                "가정의 온기가 가득한 5월, 일상 속에 따스한 그늘이 되어줄 나만의 쉼표를 찾아보세요."
            ],
            6: [
                "초록이 더 짙어지는 6월, 바쁜 일상 속에 쉼표 하나 콕 찍어주는 여유를 가져보세요.",
                "여름의 문턱에 선 6월, 싱그러운 나뭇잎의 흔들림처럼 마음 가볍게 하루를 흘려보내요.",
                "여름의 푸른 그늘이 깊어가는 6월, 선선한 나무 아래에서 기분 좋은 휴식을 즐겨보세요."
            ],
            7: [
                "한여름의 한가운데 7월, 울창한 숲속 그늘 아래서 들려오는 자연의 소리에 귀 기울여봐요.",
                "짙푸른 풀 내음이 가득한 7월, 바쁜 일은 잠시 잊고 초록빛 편안함으로 가득 채워보세요.",
                "숲의 노래가 멀리서 들려오는 7월, 나만의 아늑한 쉼터에서 깊은 이완의 시간을 가져보세요."
            ],
            8: [
                "밤하늘의 낭만이 더해가는 8월, 오늘 밤엔 가만히 하늘을 올려다보며 소원을 빌어볼까요?",
                "여름의 절정에서 맞이하는 8월, 일상에서 살짝 벗어나 마음의 속도를 한 걸음 늦춰보세요.",
                "반짝이는 여름의 흔적들이 머무는 8월, 평화롭고 시원한 숲의 온기를 전합니다."
            ],
            9: [
                "뺨을 스치는 선선한 가을 향기가 반가운 9월, 낭만적인 계절의 시작을 느껴보세요.",
                "바람의 온도가 조금씩 달라지는 9월, 다가오는 가을의 다정한 첫인사를 가만히 받아주세요.",
                "푸르던 잎들이 서서히 옷을 갈아입기 시작하는 9월, 깊어가는 계절의 풍요로움을 맛보세요."
            ],
            10: [
                "풍요롭고 아늑한 단풍의 계절 10월, 깊어가는 가을 속에서 나만의 힐링을 찾아보세요.",
                "낙엽이 하나둘 쌓여가는 길을 걸으며, 10월의 서정적인 정취를 오롯이 느껴보세요.",
                "가을의 깊은 온기가 어우러지는 10월, 마음을 따뜻하게 안아줄 작은 쉼표를 놓아보세요."
            ],
            11: [
                "차가워진 바람 속 따뜻한 온기가 그리워지는 11월, 포근하고 아늑한 대화로 하루를 채요.",
                "계절이 한 걸음 물러나며 고요함을 선물하는 11월, 따스한 차 한 잔과 함께 사색에 잠겨보세요.",
                "조용히 겨울을 마주하는 11월, 곁에 있는 소중한 온기에 감사함을 느껴보는 건 어떨까요?"
            ],
            12: [
                "반짝이는 조명 아래 올 한 해 쌓인 추억들을 따뜻하게 되돌아보는 12월 보내세요.",
                "한 해의 마지막 장인 12월, 따뜻하게 타오르는 온기 옆에서 지친 마음을 차분히 내려놓으세요.",
                "하얀 겨울의 낭만과 아늑한 전구 불빛이 가득한 12월, 평온하고 포근한 연말 되세요."
            ]
        };
        body = pick(monthGreetings[month] || monthGreetings[1]);
    } else if (rand < 0.50) {
        // B. 계절별 본문 (4계절 * 4개 = 16종) - 25% 확률
        const seasonGreetings: Record<string, string[]> = {
            spring: [
                "새로운 생명이 움트는 봄의 기운이 숲속 곳곳에 가득 차오르고 있어요.",
                "포근하게 불어오는 봄바람처럼 내 마음도 한결 부드럽고 가벼워지길 바랍니다.",
                "연둣빛 가득한 숲에서 풍겨오는 맑은 봄의 내음을 가만히 들이마셔 보세요.",
                "수줍게 피어나는 봄꽃들처럼, 우리의 하루에도 작은 설렘들이 하나씩 피어나기를 바라요."
            ],
            summer: [
                "울창하게 뻗어 나간 초록 나뭇잎들이 세상에서 가장 시원한 그늘을 빚어냅니다.",
                "짙푸른 숲이 건네는 싱그러운 풀 내음 속에서 여름의 생동감을 온몸으로 느껴보세요.",
                "풀숲 사이로 들려오는 소소한 자연의 속삭임이 나른하고 깊은 여유를 선사합니다.",
                "해 질 녘 선선해지는 숲의 맑은 공기를 들이쉬며, 무거웠던 마음을 가볍게 비워내요."
            ],
            autumn: [
                "스치는 바람마다 선선한 계절의 온도가 묻어나며 숲속 가을의 서정을 자아내요.",
                "하루하루 붉게 물들어가는 나뭇잎들처럼, 일상의 정취도 점점 깊고 따뜻해집니다.",
                "조금씩 높아지는 하늘과 선선한 바람 속에서 사색의 온도를 즐기기 좋은 계절이에요.",
                "풍요로운 자연이 남긴 가을의 빛깔을 바라보며 마음에 쉼을 선물하는 건 어떨까요?"
            ],
            winter: [
                "차가우면서도 맑고 투명한 숲속 겨울 공기가 지쳐있던 복잡한 생각들을 정돈해 줍니다.",
                "세상이 소복하고 아늑한 겨울의 고요에 둘러싸인 채, 고요히 흘러가고 있어요.",
                "포근한 겨울 아지트 안에서 따뜻한 온기를 느끼며 휴식을 취하는 일은 언제나 낭만적입니다.",
                "차분하게 내려앉은 겨울 숲의 평화를 마음에 담고, 조용하게 사색의 여유를 채워봐요."
            ]
        };
        body = pick(seasonGreetings[season] || seasonGreetings.spring);
    } else if (rand < 0.80) {
        // C. 시간대별 본문 (4시간대 * 8개 = 32종) - 30% 확률
        const timeGreetings: Record<string, string[]> = {
            morning: [
                "아침의 맑은 공기와 새소리가 오늘 하루도 포근히 열어주네요.",
                "싱그러운 새벽 이슬이 걷히며 밝아오는 아침, 기분 좋은 출발을 맞이하세요.",
                "기지개를 켜며 만나는 맑은 아침 공기 속에서 숨을 편안히 가다듬어 봐요.",
                "조용히 깨어나는 자연의 활기를 닮아, 오늘 하루도 편안하고 활기차게 시작해요.",
                "눈을 뜨자마자 느껴지는 고요하고 깨끗한 아침의 여유를 천천히 음미해 보세요.",
                "밝아오는 은은한 빛과 함께 다정한 인사를 건네며 기분 좋은 첫걸음을 내딛어 봅니다.",
                "오늘도 어김없이 선물처럼 찾아온 기분 좋은 아침, 평온함으로 가득 채워요.",
                "아침 하늘의 부드러운 빛을 바라보며 오늘 마주할 모든 여유를 축복해 봅니다."
            ],
            afternoon: [
                "바쁘게 달려온 일상이지만, 잠시 멈추고 커피 한 잔의 아늑함을 즐겨보는 오후 어때요?",
                "한 템포 천천히 쉬어가도 괜찮은 시간, 나른한 오후의 여백을 기분 좋게 누려보세요.",
                "나무 그늘 아래 한가로이 머무는 바람처럼, 평화로운 오후 되시길 바랍니다.",
                "따스함이 가만히 온몸을 감싸 안는 나른한 오후, 잠시 머리를 비워보는 시간입니다.",
                "주변을 채운 은은한 평화로움 속에 나만의 작은 쉼표를 콕 찍어 보세요.",
                "가장 평화롭고 유유자적한 오후의 한때, 일상의 걱정들은 잠시 접어두어도 좋아요.",
                "햇살이 부드럽게 부서져 내리는 시간, 느긋하고 아늑한 오후 휴식을 즐겨봐요.",
                "책 한 권이나 차 한 잔과 함께 나만의 편안한 흐름으로 흘러가는 오후를 응원합니다."
            ],
            evening: [
                "하루의 긴장이 조금씩 풀어지는 저녁, 소중한 사람들과 따뜻하고 편안한 시간 보내세요.",
                "차분하게 깊어가는 노을빛 풍경처럼, 편안하고 맛있는 저녁 되시길 바라요.",
                "바빴던 하루의 일과를 잘 갈무리하고, 다정한 온기를 나누는 포근한 저녁입니다.",
                "어둠이 은은하게 내려앉은 저녁 시간, 오늘 수고한 나에게 토닥토닥 칭찬을 보내봐요.",
                "어스름한 하늘과 고요해지는 공기 속에서 지친 마음을 편안하게 뉘어보세요.",
                "따뜻한 저녁 식사와 함께 하루 동안 쌓인 무거운 생각들을 훌훌 털어버릴 시간이에요.",
                "가장 아늑하고 무탈한 마음으로 하루의 끝자락 저녁을 평온하게 채워보세요.",
                "은은한 빛이 거리를 메우는 저녁, 마음에도 잔잔하고 부드러운 평화가 찾아들기를 기대해요."
            ],
            night: [
                "별빛이 소곤거리는 듯 고요한 이 밤, 깊고 평온한 휴식 속에 잠겨보세요.",
                "어두운 밤하늘이 세상을 포근히 안아주듯, 오늘 밤은 누구보다 아늑하고 편안하게 쉬세요.",
                "바깥의 시끄러운 소리는 잦아들고 나직한 어둠만 남은 시간, 고요함 속에 생각을 내려놓아요.",
                "은은한 달빛과 별빛이 마음의 소리를 다독여주는 평화롭고 포근한 밤입니다.",
                "오늘 하루 수고 많으셨습니다. 차분한 밤공기 속에 모든 짐을 비우고 좋은 꿈을 꿔보세요.",
                "고요한 밤의 아지트 안에서 느껴지는 정적이 마음을 가장 차분하게 채워주네요.",
                "어둠 속에서 반짝이는 작은 전구 빛을 보며, 나만의 평온하고 고적한 사색을 즐겨보세요.",
                "침구의 아늑한 온기 속에 온몸을 맡긴 채, 편안하고 평화롭게 이 밤을 마감하세요."
            ]
        };
        body = pick(timeGreetings[timeCtx] || timeGreetings.morning);
    } else {
        // D. 주중/주말 라이프스타일 본문 (주중 5개 + 주말 5개 = 10종) - 20% 확률
        const day = new Date().getDay(); // 0: 일요일, 5: 금요일, 6: 토요일
        const isWeekend = day === 0 || day === 5 || day === 6;
        const weekdayGreetings = [
            "바쁜 주중의 일상이지만 마음속으로 싱그러운 숲의 바람을 그리며 힘차게 보내세요.",
            "가장 치열하고 숨 가쁜 평일 하루, 잠시 창밖의 초록 나뭇잎을 보며 쉼표를 그려보세요.",
            "지친 평일 일상이지만, 다가올 주말의 자유로움을 그리며 마음 한편에 여유를 충전해요.",
            "해야 할 일은 많지만 나만의 템포를 잃지 않는 것, 그것이야말로 진정한 일상의 휴식입니다.",
            "바쁜 걸음걸이 속에서도 잠시 숨 고를 시간을 남겨두는 여유로운 하루를 응원합니다."
        ];
        const weekendGreetings = [
            "마침내 고대하던 즐거운 주말! 일상의 복잡한 일들은 뒤로하고 나만의 자유를 만끽해 봐요.",
            "좋아하는 음악 한 곡과 함께 마음 편안하게 흘러가는 주말의 평화로움을 오롯이 즐겨보세요.",
            "도심의 지루한 백색 소음을 끄고, 자연이 건네는 다정한 바람의 노래를 떠올려보는 주말입니다.",
            "내 마음의 속도 조절 장치를 가장 평화로운 템포로 돌려놓고, 자유로운 주말을 맞이해요.",
            "소중한 사람들과 손을 잡고 조용한 쉼의 풍경 속으로 흘러들어가는 주말의 기적을 느껴봐요."
        ];
        body = pick(isWeekend ? weekendGreetings : weekdayGreetings);
    }

    // 3단계. 힐링 이모지 데코레이터
    const emojis = [
        " 🌿✨",
        " ☕🏕️",
        " 🌳🌈",
        " 🌱🧭",
        " 🌌🔥",
        " 💫🍂"
    ];

    return `${pick(openings)}${body}${pick(emojis)}`;
};

export function usePersonalizedRecommendation(enabled = true) {
    const timeCtx = getTimeContext();

    // 1. Initial State - 진입 즉시 10ms 만에 완성되는 로컬 감성 멘트로 즉시 초기화
    const [data, setData] = useState<PersonalizedData>(() => ({
        cooking: null,
        play: null,
        events: [],
        context: {
            time: timeCtx,
            weather: 'unknown',
            temp: null,
            greeting: getGreeting()
        },
        userProfile: null
    }));

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
                        greeting: getGreeting(userProfile?.nickname || undefined)
                    },
                    reasons: {
                        cooking: cookingRationale, // Use the server-generated rationale
                        play: playReason
                    },
                    userProfile
                }));

                // IMPORTANT: Release Loading Here - Hero and Main Cards are ready
                setLoading(false);

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

    // 날씨 로딩 완료 시 context의 weather/temp 만 업데이트 (인사말은 재조립하지 않고 유지)
    useEffect(() => {
        if (!weather.loading && weather.type !== 'unknown') {
            setData(prev => ({
                ...prev,
                context: {
                    ...prev.context,
                    weather: weather.type,
                    temp: weather.temp
                }
            }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weather.loading, weather.type, weather.temp]);

    return { data, loading, weather, shuffle };
}
