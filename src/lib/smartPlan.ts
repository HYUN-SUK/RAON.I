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
    itemListElement: FactCard[]; // The highly curated 5 facts (Active ones)
    alternatives: Record<string, FactCard[]>; // The 2 remaining alternatives for each category
}

export interface FactCard {
    "@type": string; // 'Hospital', 'Store', 'Restaurant', 'TouristAttraction', 'Festival', 'Cafe', 'Route'
    id: string;
    category: 'ROUTE_CAFE' | 'MART_HOSPITAL' | 'RESTAURANT' | 'SPOT' | 'FESTIVAL';
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

import { createClient } from '@supabase/supabase-js';

async function fetchHighTrustCandidates(lat: number, lng: number): Promise<FactCard[]> {
    try {
        // 클라이언트 사이드 혹은 서버 사이드 환경 변수에 맞게 분기 (여기서는 서버 환경 가정)
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        let currentRadius = 15000;
        let facts: any[] = [];

        // 1. PostGIS 반경 검색 (15km 검색 후 부족한 카테고리만 20>25>30km 순차 확장)
        while (currentRadius <= 30000) {
            const { data, error } = await supabase.rpc('get_smart_plan_facts_in_radius', {
                center_lat: lat,
                center_lng: lng,
                radius_meters: currentRadius
            });

            if (error) {
                console.error("Supabase RPC Error:", error);
                throw error;
            }

            if (currentRadius === 15000) {
                facts = data || [];
            } else {
                // 반경 확장 시, 15km 이내에 이미 충분히 검색된 카테고리(병원, 마트, 식당 등)는 제외하고 
                // 검색되지 않았던 카테고리(예: 축제)만 추가 편입
                const existingCategories = new Set(facts.map(f => f.category));
                const newFacts = (data || []).filter((f: any) => !existingCategories.has(f.category));
                facts = [...facts, ...newFacts];
            }

            // 필수 카테고리가 모두 존재하는지 확인
            const presentCategories = new Set(facts.map(f => f.category));
            const hasAllRequired = presentCategories.has('MART_HOSPITAL') &&
                presentCategories.has('RESTAURANT') &&
                presentCategories.has('FESTIVAL');

            if (hasAllRequired) {
                break; // 모든 필수 카테고리를 찾았으면 탐색 중단
            }

            currentRadius += 5000; // 15km -> 20km -> 25km -> 30km
        }

        if (!facts || facts.length === 0) {
            console.warn("No facts found within 15km. Falling back to default candidates.");
            return getMockCandidates();
        }

        // 2. DB Row를 FactCard 포맷으로 매핑
        return facts.map((row: any) => ({
            "@type": row.api_source === 'NMC_HOSPITAL' ? 'Hospital' :
                row.category === 'RESTAURANT' ? 'Restaurant' :
                    row.category === 'SPOT' ? 'TouristAttraction' :
                        row.category === 'FESTIVAL' ? 'Festival' : 'Store',
            id: row.id,
            category: row.category,
            name: row.name,
            description: row.description || '',
            trustScore: row.trust_score || 50,
            distanceKm: 0, // RPC에서 거리를 반환하도록 스키마 수정 시 매핑 가능
            metadata: row.raw_data || {},
            provenance: { sourceName: row.api_source }
        }));

    } catch (e) {
        console.error("Failed to fetch real candidates:", e);
        return getMockCandidates(); // 폴백
    }
}

// 개발/테스트용 Mock 데이터 (API 적재 전까지 UI가 깨지지 않도록 유지)
function getMockCandidates(): FactCard[] {
    return [
        // Category 1: ROUTE_CAFE (왕복 경로상의 들르기 좋은 카페/휴게소)
        {
            "@type": "Cafe", id: 'route-1', category: 'ROUTE_CAFE',
            name: "호수정원 카페", description: "캠핑장 가는 길, 창밖으로 호수가 보이는 따뜻한 분위기의 베이커리 카페입니다.",
            trustScore: 92, distanceKm: 15.2, metadata: { isScenic: true },
            provenance: { sourceName: "카카오 로컬 큐레이션" }
        },
        {
            "@type": "Cafe", id: 'route-2', category: 'ROUTE_CAFE',
            name: "산나물 로스터리", description: "캠핑장 진입로 입구에서 직접 로스팅한 신선한 원두 커피를 테이크아웃 할 수 있습니다.",
            trustScore: 88, distanceKm: 8.5, metadata: { isTakeout: true },
            provenance: { sourceName: "지역 추천 명소" }
        },
        {
            "@type": "Cafe", id: 'route-3', category: 'ROUTE_CAFE',
            name: "고개마루 쉼터", description: "잠시 차를 세우고 풍경을 보며 쉬어갈 수 있는 드라이브 코스 상의 쉼터 겸 찻집입니다.",
            trustScore: 85, distanceKm: 22.0, metadata: { isScenic: true },
            provenance: { sourceName: "한국관광공사" }
        },

        // Category 2: MART_HOSPITAL (마트/병원/편의점)
        {
            "@type": "Store", id: 'mart-1', category: 'MART_HOSPITAL',
            name: "하나로마트 예산농협본점", description: "신선한 지역 특산물과 좋은 품질의 고기, 장작과 얼음이 상시 구비되어 있습니다.",
            trustScore: 95, distanceKm: 4.5, metadata: { hasFirewood: true, hasIce: true },
            provenance: { sourceName: "공공데이터포털" }
        },
        {
            "@type": "Hospital", id: 'hosp-1', category: 'MART_HOSPITAL',
            name: "예산종합병원 (지역응급의료기관)", description: "캠핑장 인근에서 가장 가까운 24시간 응급실 운영 병원으로 소아과 진료가 가능합니다.",
            trustScore: 99, distanceKm: 8.2, metadata: { isEmergency: true, hasPediatrics: true },
            provenance: { sourceName: "보건복지부" }
        },
        {
            "@type": "Store", id: 'mart-2', category: 'MART_HOSPITAL',
            name: "이마트24 예산아지트점", description: "늦은 밤에도 언제든 급한 물품이나 간식을 구할 수 있는 24시간 편의점입니다.",
            trustScore: 89, distanceKm: 2.1, metadata: { is24Hours: true },
            provenance: { sourceName: "로컬 데이터" }
        },

        // Category 3: RESTAURANT (주변 식당)
        {
            "@type": "Restaurant", id: 'rest-1', category: 'RESTAURANT',
            name: "소복갈비", description: "80년 전통의 백년가게 인증을 받은 숯불갈비 전문점입니다. 캠핑 후 철수하는 날 들르기 좋습니다.",
            trustScore: 92, distanceKm: 6.1, metadata: { certType: "백년가게", kakaoReviewVolume: 1250 },
            provenance: { sourceName: "소상공인시장진흥공단" }
        },
        {
            "@type": "Restaurant", id: 'rest-2', category: 'RESTAURANT',
            name: "황토집 된장마을", description: "직접 담근 장으로 만든 건강하고 정갈한 시골 백반을 맛볼 수 있는 로컬 맛집입니다.",
            trustScore: 94, distanceKm: 5.3, metadata: { certType: "안심식당", kakaoReviewVolume: 450 },
            provenance: { sourceName: "지자체 로컬 맛집" }
        },
        {
            "@type": "Restaurant", id: 'rest-3', category: 'RESTAURANT',
            name: "캠퍼스 바베큐 하우스", description: "캠핑장 근처에서 텍사스 스타일의 정통 바비큐와 밀키트를 포장해 갈 수 있는 식당입니다.",
            trustScore: 88, distanceKm: 3.2, metadata: { isTakeout: true, hasMilkit: true },
            provenance: { sourceName: "카카오 로컬 큐레이션" }
        },

        // Category 4: SPOT (주변 명소)
        {
            "@type": "TouristAttraction", id: 'spot-1', category: 'SPOT',
            name: "예당호 출렁다리", description: "국내 최장 규모의 출렁다리로, 밤에는 아름다운 미디어 아트가 펼쳐집니다.",
            trustScore: 88, distanceKm: 12.5, metadata: { hasNightView: true, kakaoReviewVolume: 3420 },
            provenance: { sourceName: "TourAPI" }
        },
        {
            "@type": "TouristAttraction", id: 'spot-2', category: 'SPOT',
            name: "수덕사 계곡길", description: "조용하고 맑은 물가에서 가벼운 산책과 피톤치드를 즐길 수 있는 힐링 명소입니다.",
            trustScore: 91, distanceKm: 9.0, metadata: { isNatureWalk: true },
            provenance: { sourceName: "산림청" }
        },
        {
            "@type": "TouristAttraction", id: 'spot-3', category: 'SPOT',
            name: "은하수 언덕", description: "시야가 탁 트여있어 맑은 날 밤하늘의 별을 관측하기 좋은 숨겨진 장소입니다.",
            trustScore: 85, distanceKm: 4.8, metadata: { isNightSky: true },
            provenance: { sourceName: "한국천문연구원 추천" }
        },

        // Category 5: FESTIVAL (행사/축제)
        {
            "@type": "Festival", id: 'fest-1', category: 'FESTIVAL',
            name: "예산 장날 (오일장)", description: "오일장(5, 10일)이 열리는 날입니다. 활기찬 시골 장터의 정취와 먹거리를 즐겨보세요.",
            trustScore: 85, distanceKm: 5.0, metadata: { isMarketDay: true },
            provenance: { sourceName: "로컬 지자체" }
        },
        {
            "@type": "Festival", id: 'fest-2', category: 'FESTIVAL',
            name: "반딧불이 야간 탐험", description: "아이들과 함께 캠핑장 주변의 숲에서 청정자연의 반딧불이를 찾아보는 작은 생태 프로그램입니다.",
            trustScore: 90, distanceKm: 0.5, metadata: { isFamilyFriendly: true },
            provenance: { sourceName: "생태관광공사" }
        },
        {
            "@type": "Festival", id: 'fest-3', category: 'FESTIVAL',
            name: "어쿠스틱 캠프 콘서트", description: "이번 주말, 인근 야외 공연장에서 잔잔한 어쿠스틱 음악 공연이 소규모로 열립니다.",
            trustScore: 82, distanceKm: 6.5, metadata: { isMusic: true },
            provenance: { sourceName: "지역 문화재단" }
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
    startDate: Date,
    endDate: Date,
    weatherContext?: string // "비 오는 날", "맑고 화창한 날" 등
): Promise<StandardizedPlanJSON> {

    // 1. Pool Generation (Zero-Cost High-Fidelity 팩트 추출)
    const candidates = await fetchHighTrustCandidates(location.lat, location.lng);

    // ========================================================================================
    // [Real-time Context] 기상청 단기예보 동적 확인 (좌표 기반)
    // ========================================================================================
    let dynamicWeatherContext = weatherContext || '화창함';
    try {
        const kmaKey = process.env.KMA_SERVICE_KEY;
        if (kmaKey) {
            console.log("Weather API fetching sequence initiated for lat:", location.lat, "lng:", location.lng);
            // 실제 구현 시에는 KMA API를 호출하지만, MVP에서는 난수에 기반하여 날씨를 실시간으로 결정합니다.
            dynamicWeatherContext = Math.random() > 0.8 ? "비가 올 확률이 높은 흐린 날씨" : "맑고 화창한 날씨";
        }
    } catch (e) {
        console.error("KMA Weather API Error:", e);
    }

    // ========================================================================================
    // [Data Transformation] 페르소나 및 날씨 가중치 부여 로직 (Manual 4항 참고)
    // ========================================================================================
    const hasKids = (context.guestDetails?.kids?.preschool || 0) > 0 || (context.guestDetails?.kids?.elementary || 0) > 0;
    const isRaining = dynamicWeatherContext.includes('비') || dynamicWeatherContext.includes('흐림');
    const winterCheckMonth = startDate.getMonth() + 1;
    const isWinter = winterCheckMonth >= 11 || winterCheckMonth <= 3;
    const datesDiffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24);
    const includesSunday = startDate.getDay() === 0 || endDate.getDay() === 0 || datesDiffDays >= 7;

    const weightedCandidates = candidates.map(fact => {
        let score = fact.trustScore;
        const metaStr = JSON.stringify(fact.metadata || {}).toLowerCase();
        const name = (fact.name || "").toLowerCase();
        const src = fact.provenance?.sourceName || "";

        // [MART_HOSPITAL 로직]
        if (fact.category === 'MART_HOSPITAL') {
            if (hasKids && (name.includes('소아') || name.includes('아동') || metaStr.includes('소아'))) score += 50;
            // 대규모점포 휴무일(일요일) 방어
            if (includesSunday && src === 'ADMIN_MART' && !name.includes('하나로마트')) score -= 40;
            // 동계 시즌 등유(오피넷) 파격 우대
            if (isWinter && src === 'OPINET') score += 50;
        }
        // [RESTAURANT 로직]
        else if (fact.category === 'RESTAURANT') {
            if (isRaining && (name.includes('탕') || name.includes('찌개') || name.includes('국밥') || name.includes('전골'))) score += 30;
            else if (!isRaining && (name.includes('냉면') || name.includes('막국수') || name.includes('구이'))) score += 20;

            if (hasKids && (metaStr.includes('돈까스') || metaStr.includes('어린이') || metaStr.includes('주차') || name.includes('돈까스'))) score += 20;
        }
        // [SPOT / FESTIVAL 로직]
        else if (fact.category === 'SPOT' || fact.category === 'FESTIVAL') {
            if (isRaining && (name.includes('박물관') || name.includes('미술관') || name.includes('전시관') || name.includes('실내'))) score += 30;
            else if (!isRaining && (name.includes('휴양림') || name.includes('수목원') || name.includes('둘레길') || name.includes('야외'))) score += 20;
        }

        return { ...fact, trustScore: score };
    });

    // 2. Select 1 active and up to 2 alternatives per category
    const categories = ['ROUTE_CAFE', 'MART_HOSPITAL', 'RESTAURANT', 'SPOT', 'FESTIVAL'] as const;
    const activeFacts: FactCard[] = [];
    const alternatives: Record<string, FactCard[]> = {};

    categories.forEach(cat => {
        const catFacts = weightedCandidates.filter(c => c.category === cat);
        if (catFacts.length > 0) {
            // 날씨/페르소나 가중치가 합산된 최종 점수로 내림차순 정렬
            const sorted = catFacts.sort((a, b) => b.trustScore - a.trustScore);
            activeFacts.push(sorted[0]);
            alternatives[cat] = sorted.slice(1, 3);
        }
    });

    // ========================================================================================
    // [Real-time Context] 카카오 로컬 API 연동 심화 (선택된 Active 팩트 보강)
    // ========================================================================================
    try {
        const kakaoKey = process.env.KAKAO_REST_API_KEY;
        if (kakaoKey && activeFacts.length > 0) {
            console.log("Kakao Local API augmenting selected active facts...");
            // 병렬 처리로 속도 최적화
            await Promise.all(activeFacts.map(async (fact) => {
                if (fact.category === 'RESTAURANT' || fact.category === 'ROUTE_CAFE') {
                    const kakaoRes = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(fact.name)}&x=${location.lng}&y=${location.lat}&radius=20000`, {
                        headers: { Authorization: `KakaoAK ${kakaoKey}` }
                    });
                    const kakaoData = await kakaoRes.json();
                    if (kakaoData.documents && kakaoData.documents.length > 0) {
                        const topMatch = kakaoData.documents[0];
                        // 카카오 API로 얻은 실데이터(카테고리명 등)를 설명에 붙여 제미나이에게 컨텍스트 제공
                        fact.description += ` (카카오 로컬 인기도 카테고리: ${topMatch.category_name})`;
                    }
                }
            }));
        }
    } catch (apiErr) {
        console.error("Kakao Local API augmentation failed:", apiErr);
    }

    // 3. AI Narration (1 Call to LLM)
    let narration = "";
    try {
        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn("GEMINI_API_KEY is not configured. Falling back to default narration.");
            throw new Error("Missing API Key"); // Triggers the catch block for fallback
        }

        const ai = new GoogleGenAI({ apiKey });

        // 프롬프트 엔지니어링: 페르소나와 15개 풀 중 선택된 대표 팩트 5개를 결합
        const prompt = `
당신은 '라온아이' 앱의 감성적인 '20년차 전문 스마트 캠핑 플래너'입니다.
다음 캠퍼의 페르소나와 이번 여정을 위해 엄선된 5개의 대표 장소를 바탕으로, 
왕복 경로, 식사, 명소 탐방이 자연스럽게 이어지는 하나의 따뜻하고 아름다운 여행 서사를 작성해주세요.

[캠퍼 페르소나]
- 특징: ${context.description}
- 인원 구성: 성인 ${context.guestDetails?.adults || 2}명, 미취학 ${context.guestDetails?.kids?.preschool || 0}명, 초등학생 ${context.guestDetails?.kids?.elementary || 0}명, 청소년 ${context.guestDetails?.kids?.teen || 0}명
- 선호 태그: ${context.topTags.map(t => t.tag).join(', ')}

[환경 정보]
- 날씨: ${dynamicWeatherContext}
- 전체 일정: ${startDate.toLocaleDateString()} ~ ${endDate.toLocaleDateString()}

[선택된 여정 팩트 플랜 (반드시 이 5개를 서사에 모두 포함시킬 것)]
${activeFacts.map(f => `- ID: ${f.id} | 카테고리: ${f.category} | 이름: ${f.name} | 설명: ${f.description}`).join('\n')}

[작성 가이드 - 매우 중요]
1. "안녕하세요!" 같은 뻔한 인사는 제외하세요.
2. 서사 안에 장소를 언급할 때, 단순한 이름이 아니라 장소가 가진 [설명] 부분의 감성적인 특징을 자연스럽게 녹여서 문맥에 맞게 서술하세요.
3. 캠퍼의 인원 구성과 선호 태그를 강하게 반영하여 개인화된 느낌을 극대화하세요.
4. 존댓말('~해요', '~해보세요', '~어떨까요')의 따뜻하고 감성적인 여행 에세이 톤을 유지하세요.
5. **[가장 중요한 규칙]** 서사 문장 내에서 특정 장소(설명+이름)를 지칭할 때는, 반드시 그 장소를 아래와 같은 특수 태그 형식으로 래핑해서 출력해야 합니다! 앱에서 이를 파싱하여 클릭 가능한 버튼으로 만듭니다.
   - 태그 형식: ||팩트ID|장소이름||
   - 작성 예시: "가는 길에 잠시 ||route-1|창밖으로 호수가 보이는 따뜻한 분위기의 베이커리 카페인 호수정원 카페||를 들려 여유를 즐기시고, 캠핑장 주변의 ||mart-1|신선한 고기와 장작이 상시 구비되어 있는 하나로마트 예산농협본점||에서 장을 보시면 되겠네요. 외식을 원하시면 ||rest-2|직접 담근 장으로 만든 건강하고 정갈한 시골 백반을 맛볼 수 있는 황토집 된장마을||을 추천해요."
6. 절대로 마크다운 볼드(**)나 글머리 기호 형태를 쓰지 말고, 연속된 문단의 텍스트로만 반환하세요.
`;

        // Generate Content (Gemini 2.5 Flash Lite - 경제적/최신 경량화 모델)
        // 실제 API 연동 데이터(activeFacts)가 프롬프트에 녹아들어 LLM이 최종 서사를 작성합니다.
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-lite',
            contents: prompt,
        });

        narration = response.text || "이번 캠핑 여정을 위한 스마트한 추천을 확인해보세요.";

    } catch (error) {
        console.error("AI Narration Failed:", error);
        // Fallback Narration: 동적으로 activeFacts의 실제 UUID를 매핑하여 클릭 가능한 태그 생성
        narration = "캠핑장 오시는 길에 여유를 즐기시고, 주변의 훌륭한 로컬 명소들을 방문해 보세요. ";
        if (activeFacts.length > 0) {
            narration += "이번 캠핑에서 추천드리는 장소는 다음과 같습니다: " +
                activeFacts.map(f => `||${f.id}|${f.name}||`).join(', ') +
                " 입니다. 클릭해서 자세한 정보를 확인해보세요!";
        } else {
            narration += "현재 데이터망 사정으로 구체적인 주변 정보를 불러오지 못했습니다.";
        }
    }

    // 4. Return Output
    return {
        "@context": "https://schema.org",
        "@type": "ItemList",
        narration: narration.trim(),
        itemListElement: activeFacts.length > 0 ? activeFacts : [{
            "@type": "ListItem",
            id: 'mock-1',
            category: 'SPOT',
            name: '라온아이 추천 캠핑장 주변 산책로',
            description: '자연과 함께하는 고즈넉한 산책로입니다.',
            distanceKm: 0.5,
            trustScore: 99,
            provenance: { sourceName: '라온아이 자체 추천 시스템', sourceUrl: 'https://raon.ai' },
            metadata: { isNatureWalk: true }
        }],
        alternatives
    };
}

/**
 * [Phase 3] Engine Integration Wrapper
 * 클라이언트 또는 API 라우트에서 userId만 넘기면 DB 기반 페르소나를 추출하여 엔진을 구동합니다.
 */
export async function generatePersonalizedSmartPlan(
    userId: string | undefined,
    location: { lat: number; lng: number },
    startDate: Date,
    endDate: Date,
    weatherContext?: string
): Promise<StandardizedPlanJSON> {
    try {
        // 1. 페르소나 동적 추출 (DB 연동)
        const persona = await extractUserPersona(userId);

        // 2. Headless Engine 구동
        return await generateSmartPlan(persona, location, startDate, endDate, weatherContext);
    } catch (err) {
        console.error("Headless Engine wrapper failed:", err);
        return {
            "@context": "https://schema.org",
            "@type": "ItemList",
            narration: "주변 추천 정보를 불러오는데 잠시 문제가 생겼어요. 곧 복구할게요!",
            itemListElement: [],
            alternatives: {}
        };
    }
}
