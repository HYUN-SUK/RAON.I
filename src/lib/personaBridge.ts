import { TagId } from './tags';
import type { FactCard } from './smartPlan';

export interface PersonaRule {
    tagId: TagId;
    appliesTo: FactCard['category'][];
    keywordBoost: string[];
    negativeKeywords: string[];
    requiredFlags?: string[];
    scoreBoost: number; // 0~50 (ContextFit에 합산될 가중치)
}

/**
 * Phase 1 전용 핵심 매칭 규칙 (12개 태그 지원)
 */
export const PERSONA_RULES: PersonaRule[] = [
    {
        tagId: 'FAMILY_INFANT',
        appliesTo: ['HOSPITAL', 'RESTAURANT', 'SPOT'],
        keywordBoost: ['소아', '아동', '수유', '어린이', '유아', '돈까스', '키즈', '체험', '박물관', '생태', '황새', '물놀이', '놀이터'],
        negativeKeywords: ['노키즈', '성인전용', '포차', '술집'],
        scoreBoost: 40
    },
    {
        tagId: 'FAMILY_PET',
        appliesTo: ['HOSPITAL', 'RESTAURANT', 'SPOT', 'MART'],
        keywordBoost: ['반려동물', '애견', '동물병원', '강아지', '펫', '동반가능', '테라스'],
        negativeKeywords: ['반려동물 금지', '애견 미동반'],
        scoreBoost: 40
    },
    {
        tagId: 'FOOD_LOCAL',
        appliesTo: ['RESTAURANT', 'MART', 'ROUTE_RESTAURANT'],
        keywordBoost: ['백년가게', '향토', '지역특산', '시장', '노포', '전통', '원조'],
        negativeKeywords: ['프랜차이즈', '체인점'],
        scoreBoost: 30
    },
    {
        tagId: 'MOOD_QUIET',
        appliesTo: ['SPOT', 'ROUTE_SPOT', 'ROUTE_CAFE'],
        keywordBoost: ['숨은', '한적한', '조용한', '사색', '힐링', '프라이빗', '산책', '숲길', '수목원'],
        negativeKeywords: ['인파', '북적이는', '유명한', '관광객많은'],
        scoreBoost: 35
    },
    {
        tagId: 'STYLE_SOLO',
        appliesTo: ['RESTAURANT', 'ROUTE_RESTAURANT', 'ROUTE_CAFE'],
        keywordBoost: ['1인분', '혼밥', '북카페', '바 테이블'],
        negativeKeywords: ['단체석', '가족모임', '예약필수'],
        scoreBoost: 25
    },
    {
        tagId: 'VIEW_OCEAN',
        appliesTo: ['SPOT', 'ROUTE_CAFE', 'RESTAURANT'],
        keywordBoost: ['오션뷰', '바다전망', '해수욕장', '수평선', '항구', '해변'],
        negativeKeywords: ['빌딩뷰', '시티뷰'],
        scoreBoost: 30
    },
    {
        tagId: 'FACILITY_PRIVATE_BATH',
        appliesTo: ['MART', 'GAS_STATION'], // 캠핑장 인근 편의시설 선호도 보정용
        keywordBoost: ['쾌적한', '깨끗한', '최신식'],
        negativeKeywords: ['노후된', '불결한'],
        scoreBoost: 20
    },
    {
        tagId: 'SEASON_WINTER',
        appliesTo: ['SPOT', 'RESTAURANT', 'GAS_STATION'],
        keywordBoost: ['실내', '난방', '등유', '온수', '온천', '스키'],
        negativeKeywords: ['야외공연', '야외수영장'],
        scoreBoost: 30
    },
    {
        tagId: 'FOOD_CAFE',
        appliesTo: ['ROUTE_CAFE', 'RESTAURANT'],
        keywordBoost: ['베이커리', '로스터리', '핸드드립', '케이크', '커피'],
        negativeKeywords: ['식사위주', '밥집'],
        scoreBoost: 30
    },
    {
        tagId: 'ACTIVITY_PHOTO',
        appliesTo: ['SPOT', 'ROUTE_SPOT', 'ROUTE_CAFE'],
        keywordBoost: ['인생샷', '포토존', '경치좋은', '예쁜', '인스타', '뷰맛집', '야경'],
        negativeKeywords: [],
        scoreBoost: 25
    }

];

/**
 * 특정 팩트 카드(장소)와 사용자의 페르소나 태그 간의 적합도 점수 산출 (0~50)
 */
export function computePersonaMatch(card: FactCard, personaTags: Record<string, number>): number {
    let totalScore = 0;
    const cardText = (card.name + ' ' + card.description).toLowerCase();

    for (const [tagId, userWeight] of Object.entries(personaTags)) {
        const rule = PERSONA_RULES.find(r => r.tagId === tagId);
        if (!rule) continue;
        if (!rule.appliesTo.includes(card.category)) continue;

        let matchCount = 0;
        // 1. Keyword Boost
        rule.keywordBoost.forEach(kw => {
            if (cardText.includes(kw.toLowerCase())) matchCount++;
        });

        // 2. Negative Penalty
        let hasNegative = false;
        rule.negativeKeywords.forEach(nkw => {
            if (cardText.includes(nkw.toLowerCase())) hasNegative = true;
        });

        if (hasNegative) {
            totalScore -= 20; // Soft Negative 페널티
        } else if (matchCount > 0) {
            // 태그 점수 비례 가중치 계산 (최대 scoreBoost까지)
            const weightFactor = Math.min(userWeight / 10, 1.0); 
            const matchFactor = Math.min(matchCount / 2, 1.2); // 키워드가 많을수록 가중치 상향
            totalScore += rule.scoreBoost * weightFactor * matchFactor;
        }
    }

    // 결과값 정규화 (0~50)
    return Math.min(50, Math.max(0, Math.round(totalScore)));
}
