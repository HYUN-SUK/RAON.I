// ========================================================================================
// Smart Camping Plan Phase 1: Guided Journey Headless Engine
// ========================================================================================
import { UserPersona, extractUserPersona } from './persona';
import { GoogleGenAI } from '@google/genai';

// [AI Agent Ready] Standardized Schema.org compatible output
export interface StandardizedPlanJSON {
    "@context": "https://schema.org",
    "@type": "ItemList",
    narration: string;         // AI Generated emotional guide narrative
    itemListElement: FactCard[]; // The highly curated 3-5 facts
}

export interface FactCard {
    "@type": string; // 'Hospital', 'Store', 'Restaurant', 'TouristAttraction', 'Festival'
    id: string;
    category: 'HOSPITAL' | 'MART' | 'RESTAURANT' | 'SPOT' | 'FESTIVAL';
    name: string;
    description: string;
    trustScore: number;      // Raon Trust Score
    distanceKm?: number;
    metadata: Record<string, any>; // specific data (e.g. is24Hours, certType)
    provenance: {            // Data Origin
        sourceName: string;
        sourceUrl?: string;
    };
}

// Mocking the DB fetch for Phase 1 testing
// In Phase 3, this will call Supabase `rpc('get_high_trust_facilities', { lat, lng })`
async function fetchHighTrustCandidates(lat: number, lng: number): Promise<FactCard[]> {
    return [
        {
            "@type": "Store",
            id: 'mart-1',
            category: 'MART',
            name: "하나로마트 예산농협본점",
            description: "신선한 지역 특산물과 좋은 품질의 고기를 구할 수 있는 대형 마트입니다. 장작과 얼음도 상시 구비되어 있습니다.",
            trustScore: 95,
            distanceKm: 4.5,
            metadata: { hasFirewood: true, hasIce: true },
            provenance: { sourceName: "PublicDataPortal" }
        },
        {
            "@type": "Hospital",
            id: 'hosp-1',
            category: 'HOSPITAL',
            name: "예산종합병원 (지역응급의료기관)",
            description: "캠핑장 인근에서 가장 가까운 24시간 응급실 운영 병원입니다.",
            trustScore: 99,
            distanceKm: 8.2,
            metadata: { isEmergency: true, hasPediatrics: true },
            provenance: { sourceName: "Ministry of Health and Welfare" }
        },
        {
            "@type": "Restaurant",
            id: 'rest-1',
            category: 'RESTAURANT',
            name: "소복갈비",
            description: "80년 전통의 백년가게 인증을 받은 숯불갈비 전문점입니다. 캠핑 후 철수하는 날 들르기 좋습니다.",
            trustScore: 92,
            distanceKm: 6.1,
            metadata: { certType: "백년가게", kakaoReviewVolume: 1250 },
            provenance: { sourceName: "Small Enterprise and Market Service" }
        },
        {
            "@type": "TouristAttraction",
            id: 'spot-1',
            category: 'SPOT',
            name: "예당호 출렁다리",
            description: "국내 최장 규모의 출렁다리로, 밤에는 아름다운 미디어 아트가 펼쳐집니다.",
            trustScore: 88,
            distanceKm: 12.5,
            metadata: { hasNightView: true, kakaoReviewVolume: 3420 },
            provenance: { sourceName: "TourAPI" }
        },
        {
            "@type": "Festival",
            id: 'fest-1',
            category: 'FESTIVAL',
            name: "예산 장날 (오일장)",
            description: "마침 캠핑 일정에 예산 오일장(5, 10일)이 열립니다. 활기찬 시골 장터의 정취를 느껴보세요.",
            trustScore: 85,
            distanceKm: 5.0,
            metadata: { isMarketDay: true },
            provenance: { sourceName: "LocalGov" }
        }
    ];
}

/**
 * Headless Recommendation Engine
 * (UI 독립적인 순수 데이터/서사 생성 엔진)
 */
export async function generateSmartPlan(
    context: UserPersona,
    location: { lat: number; lng: number },
    date: Date,
    weatherContext?: string // "비 오는 날", "맑고 화창한 날" 등
): Promise<StandardizedPlanJSON> {

    // 1. Pool Generation (Zero-Cost High-Fidelity 팩트 추출)
    const candidates = await fetchHighTrustCandidates(location.lat, location.lng);

    // 2. Circular Selection (임시로 상위 3개 고정, 실제로는 랜덤/순환 추출 로직 적용)
    // "식당은 1개, 명소 1개, 마트 1개" 식으로 Rule-based 배합
    const selectedFacts = candidates.slice(0, 3);

    // 3. AI Narration (1 Call to LLM)
    let narration = "";
    try {
        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn("GEMINI_API_KEY is not configured. Falling back to default narration.");
            throw new Error("Missing API Key"); // Triggers the catch block for fallback
        }

        const ai = new GoogleGenAI({ apiKey });

        // 프롬프트 엔지니어링: 페르소나와 팩트를 결합하여 감성적인 스토리를 요구
        const prompt = `
당신은 라온아이 앱의 감성적인 '스마트 캠핑 가이드'입니다.
다음 캠퍼의 페르소나와 주변 추천 장소(팩트)를 바탕으로, 이번 캠핑 여정에 대한 따뜻하고 개인화된 안내 서사를 3문장 내외로 작성해주세요.

[캠퍼 페르소나]
- 특징: ${context.description}
- 인원 구성: 성인 ${context.guestDetails?.adults || 2}명, 미취학 ${context.guestDetails?.kids?.preschool || 0}명, 초등학생 ${context.guestDetails?.kids?.elementary || 0}명, 청소년 ${context.guestDetails?.kids?.teen || 0}명
- 선호 태그: ${context.topTags.map(t => t.tag).join(', ')}

[환경 정보]
- 날씨: ${weatherContext || '화창함'}
- 일정: ${date.toLocaleDateString()}

[선택된 추천 장소 팩트]
${selectedFacts.map(f => `- ${f.name} (${f.description})`).join('\n')}

[작성 가이드]
- "안녕하세요!" 같은 뻔한 인사는 생략하세요.
- 캠퍼의 인원 구성(예: 아이들과 함께라면)과 선호 태그를 문맥에 부드럽게 녹여내세요.
- 선택된 장소들을 억지로 모두 나열하지 말고, 여정의 흐름(장보기 -> 캠핑 -> 퇴실 등)처럼 자연스럽게 이어지듯 표현하세요.
- 따뜻하고 정중한 '해요체'를 사용하세요.
`;

        // Generate Content (Gemini 1.5 Flash - 빠르고 저렴함)
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: prompt,
        });

        narration = response.text || "이번 캠핑 여정을 위한 스마트한 추천을 확인해보세요.";

    } catch (error) {
        console.error("AI Narration Failed:", error);
        // Fallback Narration
        narration = `이번 캠핑을 더 편안하게 만들어줄 주변 추천 장소들을 모아봤습니다. 안전하고 즐거운 캠핑 되세요!`;
    }

    // 4. Return Output
    return {
        "@context": "https://schema.org",
        "@type": "ItemList",
        narration,
        itemListElement: selectedFacts.length > 0 ? selectedFacts : [{
            "@type": "ListItem",
            id: 'mock-1',
            category: 'SPOT',
            name: '라온아이 추천 캠핑장 주변 산책로',
            description: '자연과 함께하는 고즈넉한 산책로입니다.',
            distanceKm: 0.5,
            trustScore: 99,
            provenance: { sourceName: '라온아이 자체 추천 시스템', sourceUrl: 'https://raon.ai' },
            metadata: { isNatureWalk: true }
        }]
    };
}

/**
 * [Phase 3] Engine Integration Wrapper
 * 클라이언트 또는 API 라우트에서 userId만 넘기면 DB 기반 페르소나를 추출하여 엔진을 구동합니다.
 */
export async function generatePersonalizedSmartPlan(
    userId: string | undefined,
    location: { lat: number; lng: number },
    date: Date,
    weatherContext?: string
): Promise<StandardizedPlanJSON> {
    try {
        // 1. 페르소나 동적 추출 (DB 연동)
        const persona = await extractUserPersona(userId);

        // 2. Headless Engine 구동
        return await generateSmartPlan(persona, location, date, weatherContext);
    } catch (err) {
        console.error("Headless Engine wrapper failed:", err);
        return {
            "@context": "https://schema.org",
            "@type": "ItemList",
            narration: "주변 추천 정보를 불러오는데 잠시 문제가 생겼어요. 곧 복구할게요!",
            itemListElement: []
        };
    }
}
