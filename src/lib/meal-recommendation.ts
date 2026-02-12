export interface MealRecommend {
    id: string;
    name: string;
    description: string;
    tags: string[];
    season: ('spring' | 'summer' | 'autumn' | 'winter')[];
    weather?: ('sunny' | 'rainy' | 'cloudy' | 'snowy')[];
    difficulty: 'easy' | 'medium' | 'hard';
}

const MEAL_DATABASE: MealRecommend[] = [
    {
        id: 'pork-belly',
        name: '솥뚜껑 삼겹살',
        description: '캠핑의 국룰! 김치와 함께 구워먹는 삼겹살 파티',
        tags: ['#고기', '#저녁', '#술안주'],
        season: ['spring', 'summer', 'autumn', 'winter'],
        difficulty: 'easy'
    },
    {
        id: 'oden-soup',
        name: '꼬치 어묵탕',
        description: '쌀쌀한 날씨에 딱! 따끈한 국물과 쫄깃한 어묵',
        tags: ['#국물', '#따뜻한', '#겨울철'],
        season: ['autumn', 'winter'],
        weather: ['rainy', 'snowy', 'cloudy'],
        difficulty: 'easy'
    },
    {
        id: 'grilled-skewers',
        name: '모듬 꼬치구이',
        description: '맥주 안주로 최고! 하나씩 빼먹는 재미가 있어요',
        tags: ['#꼬치', '#안주', '#간식'],
        season: ['spring', 'summer', 'autumn'],
        difficulty: 'medium'
    },
    {
        id: 'kimchi-stew',
        name: '돼지고기 김치찌개',
        description: '한국인의 소울푸드, 해장으로도 그만이죠',
        tags: ['#찌개', '#한식', '#얼큰한'],
        season: ['spring', 'summer', 'autumn', 'winter'],
        difficulty: 'medium'
    },
    {
        id: 'gambas',
        name: '감바스 알 아히요',
        description: '와인 한 잔과 함께 즐기는 스페인 요리',
        tags: ['#양식', '#분위기', '#와인'],
        season: ['spring', 'summer', 'autumn', 'winter'],
        difficulty: 'easy'
    },
    {
        id: 'ramen',
        name: '해물 라면',
        description: '신선한 해물을 넣어 끓인 최고의 야식',
        tags: ['#면요리', '#야식', '#간단'],
        season: ['spring', 'summer', 'autumn', 'winter'],
        difficulty: 'easy'
    },
    {
        id: 'dakgalbi',
        name: '춘천 닭갈비',
        description: '매콤달콤한 양념에 볶음밥까지 완벽한 코스',
        tags: ['#닭고기', '#볶음밥', '#메인요리'],
        season: ['spring', 'summer', 'autumn', 'winter'],
        difficulty: 'medium'
    },
    {
        id: 'shabu',
        name: '밀푀유 나베',
        description: '보기에도 예쁘고 맛도 좋은 따뜻한 전골 요리',
        tags: ['#전골', '#손님초대', '#비주얼'],
        season: ['autumn', 'winter'],
        difficulty: 'medium'
    },
    {
        id: 'corn-cheese',
        name: '콘치즈',
        description: '아이들도 좋아하는 달달하고 고소한 간식',
        tags: ['#간식', '#아이들', '#치즈'],
        season: ['spring', 'summer', 'autumn', 'winter'],
        difficulty: 'easy'
    }
];

export function getMealRecommendations(month: number, weather?: string): MealRecommend[] {
    let currentSeason: 'spring' | 'summer' | 'autumn' | 'winter' = 'spring';

    if (month >= 3 && month <= 5) currentSeason = 'spring';
    else if (month >= 6 && month <= 8) currentSeason = 'summer';
    else if (month >= 9 && month <= 11) currentSeason = 'autumn';
    else currentSeason = 'winter';

    // Filter by season
    let filtered = MEAL_DATABASE.filter(meal => meal.season.includes(currentSeason));

    // Filter by weather if provided (and applicable)
    if (weather && (weather === 'rainy' || weather === 'snowy')) {
        const weatherFiltered = filtered.filter(meal => meal.weather?.includes(weather as any));
        if (weatherFiltered.length > 0) {
            filtered = weatherFiltered;
        }
    }

    // Shuffle and pick 3
    return filtered.sort(() => 0.5 - Math.random()).slice(0, 3);
}
