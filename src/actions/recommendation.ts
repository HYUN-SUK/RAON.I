'use server';

import { createClient } from '@/lib/supabase-server';
import { getForecast } from '@/lib/weather';

export interface RecipeSearchResult {
    id: string;
    title: string;
    description?: string;
    category: string;
    image_url?: string;
    time_required?: number;
    difficulty?: number;
    tags?: string[];
}

export type RecipeDetail = any;

// --- 🎭 Phrase Templates (The "Slot Machine") ---

const OPENINGS = [
    "캠핑의 낭만은 역시 먹는 거죠,",
    "지금 이 순간,",
    "감성 가득한 캠핑장에서,",
    "출출해지는 이 시간,",
    "자연 속에서 즐기는,",
    "특별한 하루를 위해,",
    "캠퍼님의 취향을 저격할,",
    "분위기 있는 식사를 위해,",
    "잊지 못할 추억이 될,",
    "입안 가득 행복을 채워줄,"
];

const WEATHER_PHRASES = {
    rainy: [
        "비 내리는 빗소리를 들으며,",
        "촉촉한 감성의 비 오는 날엔,",
        "비 오는 숲속의 운치와 함께,",
        "떨어지는 빗방울을 바라보며,"
    ],
    snowy: [
        "하얀 눈이 내리는 날엔,",
        "눈 덮인 풍경을 바라보며,",
        "겨울 왕국 같은 설원 속에서,",
        "포근한 눈과 함께하는 시간에,"
    ],
    cold: [
        "쌀쌀한 바람이 불 땐,",
        "몸을 녹여줄 온기가 필요할 때,",
        "추운 날씨엔 역시,",
        "차가운 공기가 감돌 땐,"
    ],
    hot: [
        "무더운 날씨엔,",
        "햇살이 뜨거운 날엔,",
        "더위를 시원하게 날려버릴,",
        "땀 흘린 뒤 개운하게,"
    ],
    sunny: [
        "햇살이 따스하게 비추는 날엔,",
        "화창한 날씨와 어울리는,",
        "맑은 하늘 아래서,",
        "기분 좋은 햇살과 함께,"
    ],
    cloudy: [
        "선선한 바람이 부는 흐린 날,",
        "구름 낀 날의 차분한 무드엔,",
        "흐린 날의 낭만을 더해줄,",
        "운치 있는 구름 아래서,"
    ]
};

const TIME_PHRASES = {
    morning: [ // 06-10
        "산뜻한 아침을 여는,",
        "부담 없이 든든한,",
        "상쾌한 하루의 시작을 위한,",
        "잠든 미각을 깨우는,",
        "향긋한 모닝 커피와 어울리는,"
    ],
    lunch: [ // 11-15
        "활력을 충전할,",
        "간편하지만 맛있는,",
        "오후의 에너지가 될,",
        "든든한 점심으로 딱인,",
        "입맛 돋우는 별미,"
    ],
    dinner: [ // 16-20
        "본격적인 바비큐 파티를 위한,",
        "모두가 감탄할 메인 디쉬,",
        "캠핑의 꽃, 저녁 만찬을 위한,",
        "풍성한 저녁 식탁을 빛낼,",
        "하루의 하이라이트,"
    ],
    night: [ // 21-05
        "깊어가는 밤, 술 한잔과 어울리는,",
        "가볍게 즐기는 야식으로,",
        "불멍 하며 즐기기 좋은,",
        "감성 적인 밤을 위한,",
        "출출한 밤을 달래줄,"
    ]
};

const CLOSINGS = [
    "이런 메뉴 어떠세요?",
    "이 요리가 딱이에요!",
    "최고의 선택이 될 거예요.",
    "강력 추천합니다.",
    "요리를 추천드려요.",
    "맛있는 추억을 만들어보세요.",
    "한번 도전해보세요!",
    "꼭 한번 드셔보세요."
];


// --- Helper Functions ---

/**
 * Get current time context (KST based rough estimation)
 */
function getTimeContext(): 'morning' | 'lunch' | 'dinner' | 'night' {
    // Server might be UTC, so add 9 hours for KST if needed. 
    // Assuming Node env might be UTC.
    const date = new Date();
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const kst = new Date(utc + (9 * 60 * 60 * 1000));
    const hour = kst.getHours();

    if (hour >= 6 && hour < 11) return 'morning';
    if (hour >= 11 && hour < 16) return 'lunch';
    if (hour >= 16 && hour < 21) return 'dinner';
    return 'night';
}

function getSeason(): 'spring' | 'summer' | 'autumn' | 'winter' {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter';
}

function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}


// --- Main Action ---

/**
 * 키워드로 레시피 검색
 */
export async function searchRecipes(query: string): Promise<RecipeSearchResult[]> {
    if (!query.trim()) return [];

    const supabase = await createClient();

    const { data, error } = await supabase
        .from('recommendation_pool')
        .select('id, title, description, category, image_url, metadata')
        .eq('category', 'cooking') // 요리만 검색
        .ilike('title', `%${query}%`)
        .limit(20);

    if (error) {
        console.error('Search recipes error:', error);
        return [];
    }

    return data.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        category: item.category,
        image_url: item.image_url,
        time_required: item.metadata?.time_required,
        difficulty: item.metadata?.difficulty,
    }));
}

/**
 * 랜덤 추천 요리 가져오기 (DB 연동)
 */
export async function getRandomRecommendations(count: number = 3): Promise<RecipeSearchResult[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('recommendation_pool')
        .select('id, title, description, category, image_url, metadata, tags, difficulty')
        .eq('category', 'cooking')
        .limit(50);

    if (error) return [];
    if (!data || data.length === 0) return [];

    const shuffled = data.sort(() => 0.5 - Math.random()).slice(0, count);

    return shuffled.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        category: item.category,
        image_url: item.image_url,
        time_required: item.metadata?.time_required,
        difficulty: item.difficulty,
        tags: item.tags || []
    }));
}


/**
 * ID로 레시피 상세 조회
 */
export async function getRecipeById(id: string): Promise<RecipeDetail | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('recommendation_pool')
        .select('*')
        .eq('id', id)
        .single();

    if (error) return null;
    return data;
}

/**
 * 상황별 맞춤 추천 (날씨, 인원, 시즌, 시간 등)
 */
export async function getPersonalizedRecommendations(
    count: number = 3,
    context: {
        lat?: number;
        lng?: number;
        dateStr?: string;
        memberCount?: number;
    }
): Promise<{ recommendations: RecipeSearchResult[]; rationale: string }> {
    const supabase = await createClient();

    // 1. Fetch Pool (Larger set)
    const { data: pool, error } = await supabase
        .from('recommendation_pool')
        .select('id, title, description, category, image_url, metadata, tags, difficulty, servings')
        .eq('category', 'cooking');

    if (error || !pool || pool.length === 0) {
        // Fallback Rationale
        return { recommendations: [], rationale: '캠핑의 낭만은 역시 맛있는 요리죠! 이 메뉴들은 어떠세요?' };
    }

    let filtered = pool;
    const timeCtx = getTimeContext(); // 'morning' | 'lunch' | 'dinner' | 'night'

    // Helper for safe tag checking
    const hasTag = (item: any, tag: string) => {
        if (!item?.tags) return false;
        if (Array.isArray(item.tags)) return item.tags.includes(tag);
        if (typeof item.tags === 'string') return item.tags.includes(tag);
        return false;
    };

    // Check if item text contains keyword
    const hasKeyword = (item: any, keyword: string) => {
        const title = item.title?.toLowerCase() || '';
        const desc = item.description?.toLowerCase() || '';
        return title.includes(keyword) || desc.includes(keyword);
    }

    // 2. Fetch Weather (if lat/lng/date provided)
    let weather = null;
    if (context.lat && context.lng && context.dateStr) {
        weather = await getForecast(context.lat, context.lng, context.dateStr);
    }

    // 3. Determine Conditions
    const isRainy = weather?.sky?.toLowerCase().includes('rain') || weather?.sky?.toLowerCase().includes('cloud') || weather?.sky?.toLowerCase().includes('snow');
    const isCold = (weather?.temp_min !== undefined && weather.temp_min < 10);
    const isHot = (weather?.temp_max !== undefined && weather.temp_max > 30);

    let weatherKey: keyof typeof WEATHER_PHRASES = 'sunny';
    if (isRainy) weatherKey = 'rainy';
    else if (weather?.sky?.toLowerCase().includes('snow')) weatherKey = 'snowy';
    else if (isCold) weatherKey = 'cold';
    else if (isHot) weatherKey = 'hot';
    else if (weather?.sky?.toLowerCase().includes('cloud')) weatherKey = 'cloudy';


    // --- 4. Filtering Logic (Score & Sort) ---
    // Instead of strict filtering which might return 0 results, let's use Scoring.

    const scoredItems = filtered.map(item => {
        let score = 0;

        // [Time Scoring]
        if (timeCtx === 'morning') {
            if (hasTag(item, '#아침') || hasTag(item, '#브런치') || hasTag(item, '#해장') || hasTag(item, '#국물')) score += 50;
            if (hasTag(item, '#간단')) score += 30;
            if (hasKeyword(item, '샌드위치') || hasKeyword(item, '죽') || hasKeyword(item, '스프')) score += 30;
            if (hasTag(item, '#바비큐') || hasTag(item, '#헤비')) score -= 50;
        } else if (timeCtx === 'lunch') {
            if (hasTag(item, '#점심') || hasTag(item, '#면요리') || hasTag(item, '#덮밥')) score += 40;
            if (hasTag(item, '#간단')) score += 20;
        } else if (timeCtx === 'dinner') {
            if (hasTag(item, '#메인요리') || hasTag(item, '#바비큐') || hasTag(item, '#전골') || hasTag(item, '#구이')) score += 50;
            if (hasTag(item, '#파티')) score += 40;
        } else if (timeCtx === 'night') {
            if (hasTag(item, '#안주') || hasTag(item, '#야식') || hasTag(item, '#꼬치')) score += 50;
            if (hasTag(item, '#마른안주') || hasTag(item, '#탕')) score += 40;
            if (hasTag(item, '#헤비')) score -= 20;
        }

        // [Weather Scoring]
        if (isRainy || isCold) {
            if (hasTag(item, '#국물') || hasTag(item, '#따뜻한') || hasTag(item, '#전골')) score += 40;
            if (item.metadata?.weather && item.metadata.weather.includes('rainy')) score += 50;
        } else if (isHot) {
            if (hasTag(item, '#시원한') || hasTag(item, '#이열치열')) score += 40;
            if (hasTag(item, '#국물')) score -= 30; // Too hot for soup? maybe
        }

        // [Member Count]
        const memberCount = context.memberCount || 2;
        if (memberCount > 2) {
            if (hasTag(item, '#파티') || hasTag(item, '#대용량') || parseInt(item.servings || '2') >= 3) score += 30;
        } else {
            if (hasTag(item, '#혼밥') || hasTag(item, '#간단') || parseInt(item.servings || '2') <= 2) score += 30;
        }

        // Random jitter to rotate same-score items
        score += Math.random() * 20;

        return { ...item, _score: score };
    });

    // Sort by score
    scoredItems.sort((a, b) => b._score - a._score);

    // Top 20 candidates, then shuffle top 3
    const candidates = scoredItems.slice(0, 20);
    const shuffled = candidates.sort(() => 0.5 - Math.random());
    const result = shuffled.slice(0, count);


    // --- 5. Rationale Generation (Slot Machine) ---

    // Slot 1: Opening
    const opening = pickRandom(OPENINGS);

    // Slot 2: Weather
    // Only use weather slot if context exists, otherwise skip or use generic
    const weatherPhrase = weather ? pickRandom(WEATHER_PHRASES[weatherKey]) : "날씨 좋은 날,";

    // Slot 3: Time
    const timePhrase = pickRandom(TIME_PHRASES[timeCtx]);

    // Slot 4: Closing
    const closing = pickRandom(CLOSINGS);

    // Combine
    // ex: "지금 이 순간, 쌀쌀한 바람이 불 땐, 깊어가는 밤 술 한잔과 어울리는, 이 요리가 딱이에요!"
    const rationale = `${opening} ${weatherPhrase} ${timePhrase} ${closing}`;


    const recommendations = result.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        category: item.category,
        image_url: item.image_url,
        time_required: item.metadata?.time_required,
        difficulty: item.difficulty,
        tags: item.tags || []
    }));

    return { recommendations, rationale };
}
