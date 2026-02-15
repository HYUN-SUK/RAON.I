import { WeatherData } from '@/types/weather';

export interface MealRecommendation {
    id: string;
    title: string;
    description: string;
    reason: string; // "비 오는 날엔 국물이 최고죠", "아이들이 좋아하는 메뉴예요"
    image_keyword: string; // for searching or placeholder
    tags: string[];
}

interface ExternalWeather {
    temp: number;
    weatherCode: 'sunny' | 'cloudy' | 'partly_cloudy' | 'rainy' | 'snowy';
}

/**
 * Get Meal Recommendations based on context
 * AI 없이 규칙 기반(Rule-based)으로 상황에 맞는 메뉴를 추천합니다.
 * 
 * @param weather - Current weather conditions
 * @param memberCount - Number of people
 * @param withKids - Whether children are present
 * @returns Array of MealRecommendation
 */
export function getMealRecommendation(
    weather: ExternalWeather,
    memberCount: number,
    withKids: boolean = false
): MealRecommendation[] {
    const recommendations: MealRecommendation[] = [];

    // 1. Weather Based Rules
    if (weather.weatherCode === 'rainy') {
        recommendations.push({
            id: 'rain-1',
            title: '부대찌개',
            description: '소세지와 햄을 듬뿍 넣은 얼큰한 국물',
            reason: '비 오는 날, 텐트 안에서 듣는 빗소리와 따뜻한 국물은 낭만 그 자체죠.',
            image_keyword: 'korean army stew',
            tags: ['국물', '따뜻함', '소주한잔']
        });
        recommendations.push({
            id: 'rain-2',
            title: '해물파전 & 막걸리',
            description: '바삭한 파전과 시원한 막걸리 한 잔',
            reason: '타닥타닥 빗소리가 부침개 굽는 소리와 닮았대요.',
            image_keyword: 'korean pancake',
            tags: ['별미', '전', '감성']
        });
    } else if (weather.weatherCode === 'snowy' || weather.temp < 5) {
        recommendations.push({
            id: 'winter-1',
            title: '어묵탕',
            description: '김이 모락모락 나는 꼬치 어묵',
            reason: '추운 날 호호 불어가며 먹는 어묵 국물만큼 따뜻한 게 없죠.',
            image_keyword: 'fish cake soup',
            tags: ['국물', '겨울', '따뜻함']
        });
        recommendations.push({
            id: 'winter-2',
            title: '군고구마 & 코코아',
            description: '난로 위에서 구운 달콤한 고구마',
            reason: '겨울 캠핑의 하이라이트는 역시 난로 간식이죠.',
            image_keyword: 'roasted sweet potato',
            tags: ['간식', '겨울', '달콤함']
        });
    } else if (weather.temp > 28) {
        recommendations.push({
            id: 'summer-1',
            title: '냉모밀',
            description: '살얼음 동동 띄운 시원한 육수',
            reason: '더위에 지친 입맛을 살려줄 시원한 한 끼가 필요해요.',
            image_keyword: 'cold buckwheat noodles',
            tags: ['시원함', '여름', '점심']
        });
        recommendations.push({
            id: 'summer-2',
            title: '수박 화채',
            description: '달콤한 수박과 탄산수의 만남',
            reason: '여름 캠핑의 무더위를 한방에 날려버릴 디저트!',
            image_keyword: 'watermelon punch',
            tags: ['디저트', '시원함', '여름']
        });
    } else {
        // Normal Weather (Sunny/Cloudy)
        recommendations.push({
            id: 'normal-1',
            title: '바베큐 (삼겹살/목살)',
            description: '숯불 향 가득한 캠핑의 정석',
            reason: '캠핑의 꽃은 역시 숯불에 구워 먹는 고기죠!',
            image_keyword: 'bbq pork',
            tags: ['고기', '저녁', '필수']
        });
    }

    // 2. Group Composition Based Rules (Prioritized if Kids)
    if (withKids) {
        recommendations.unshift({
            id: 'kids-1',
            title: '소떡소떡',
            description: '휴게소보다 더 맛있는 엄마표 간식',
            reason: '아이들이 엄지 척! 들어올릴 인기 만점 간식이에요.',
            image_keyword: 'sotteok sotteok',
            tags: ['간식', '아이들', '쉬운요리']
        });
        recommendations.push({
            id: 'kids-2',
            title: '크림 카레',
            description: '우유를 넣어 부드러운 카레',
            reason: '맵지 않고 고소해서 아이들도 한 그릇 뚝딱 비울 거예요.',
            image_keyword: 'cream curry',
            tags: ['밥', '아이들', '부드러움']
        });
    }

    // 3. Count Based Rules
    if (memberCount >= 6) {
        recommendations.push({
            id: 'group-1',
            title: '닭볶음탕',
            description: '큰 냄비에 끓여 다 같이 나눠먹는 맛',
            reason: '여럿이 둘러앉아 먹기에 이만한 메뉴가 없죠.',
            image_keyword: 'spicy chicken stew',
            tags: ['단체', '메인요리', '칼칼함']
        });
    } else if (memberCount <= 2 && !withKids) {
        recommendations.push({
            id: 'couple-1',
            title: '감바스 알 아히요',
            description: '마늘 향 가득한 오일과 바게트',
            reason: '와인 한 잔 곁들이며 분위기 내기 딱 좋은 메뉴예요.',
            image_keyword: 'gambas al ajillo',
            tags: ['안주', '커플', '분위기']
        });
    }

    // Default Fallback
    if (recommendations.length < 3) {
        recommendations.push({
            id: 'default-1',
            title: '라면',
            description: '밖에서 먹으면 10배 더 맛있는 라면',
            reason: '설명이 필요 없는 캠핑 요리의 진리.',
            image_keyword: 'instant noodles',
            tags: ['간단', '국물', '야식']
        });
    }

    // Slice to logic limit (e.g. 5)
    return recommendations.slice(0, 5);
}
