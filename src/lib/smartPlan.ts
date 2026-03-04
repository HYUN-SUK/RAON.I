// ========================================================================================
// Smart Camping Plan Phase 1: Guided Journey Headless Engine
// ========================================================================================
import { UserPersona, extractUserPersona } from './persona';
import { getForecast } from '@/lib/weather';

// [AI Agent Ready] Standardized Schema.org compatible output
export interface StandardizedPlanJSON {
    "@context": "https://schema.org",
    "@type": "ItemList",
    narration: string;         // AI Generated emotional guide narrative
    itemListElement: FactCard[]; // Track A: Destination Core Facts (15 slots)
    routeListElement?: FactCard[]; // Track B: Journey (Route/Midpoint) Facts
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
                const existingCategories = new Set(facts.map(f => f.category));
                const newFacts = (data || []).filter((f: any) => !existingCategories.has(f.category));
                facts = [...facts, ...newFacts];
            }

            const presentCategories = new Set(facts.map(f => f.category));
            const hasAllRequired = presentCategories.has('MART_HOSPITAL') &&
                presentCategories.has('RESTAURANT') &&
                presentCategories.has('FESTIVAL');

            if (hasAllRequired) {
                break;
            }
            currentRadius += 5000;
        }

        if (!facts || facts.length === 0) {
            // No data in DB for this location? Return empty but stay resilient
            return [];
        }

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
            distanceKm: 0,
            metadata: row.raw_data || {},
            provenance: { sourceName: row.api_source }
        }));

    } catch (e) {
        console.error("Failed to fetch real candidates:", e);
        return [];
    }
}

/**
 * Kakao Mobility API를 통한 실제 도로 경로상의 중간 지점(Midpoint) 샘플링
 */
async function getMidpointOnRoad(origin: { lat: number, lng: number }, dest: { lat: number, lng: number }): Promise<{ lat: number, lng: number } | null> {
    const apiKey = process.env.KAKAO_REST_API_KEY;
    if (!apiKey) {
        console.warn("[SmartPlan] Missing KAKAO_REST_API_KEY for path sampling");
        return null;
    }

    try {
        const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${origin.lng},${origin.lat}&destination=${dest.lng},${dest.lat}&priority=RECOMMEND`;
        const res = await fetch(url, {
            headers: { 'Authorization': `KakaoAK ${apiKey}` }
        });
        const data = await res.json();

        if (data.routes && data.routes[0] && data.routes[0].sections[0]) {
            const section = data.routes[0].sections[0];
            const roadmap = section.roads || [];
            if (roadmap.length > 0) {
                // 경로상의 약 50% 지점 도로 좌표 추출
                const middleRoad = roadmap[Math.floor(roadmap.length / 2)];
                const coords = middleRoad.vertexes || [];
                if (coords.length >= 2) {
                    return { lng: coords[0], lat: coords[1] };
                }
            }
        }
        return null;
    } catch (e) {
        console.error("Kakao Mobility Path sampling failed:", e);
        return null;
    }
}

/**
 * Headless Recommendation Engine (Round-trip Journey Version)
 */
export async function generateSmartPlan(
    context: UserPersona,
    location: { lat: number; lng: number }, // Destination (Campground)
    startDate: Date,
    endDate: Date,
    origin?: { lat: number; lng: number } // User Current Location
): Promise<StandardizedPlanJSON> {

    // 1. Weather Context Aggregation (Whole trip)
    let weatherSummary = "맑음";
    try {
        const days = Math.ceil(Math.abs(endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;
        const weatherList = [];
        for (let i = 0; i < Math.min(days, 3); i++) {
            const checkDate = new Date(startDate);
            checkDate.setDate(startDate.getDate() + i);
            const w = await getForecast(location.lat, location.lng, checkDate.toISOString().split('T')[0]);
            if (w) weatherList.push(`Day ${i + 1}: ${w.sky}(${w.temp_min}~${w.temp_max}도)`);
        }
        if (weatherList.length > 0) weatherSummary = weatherList.join(', ');
    } catch (e) {
        console.error("Weather Aggregation Failed:", e);
    }

    // 2. Journey Sampling (Kakao Mobility Route-based)
    let midpoint = null;
    if (origin) {
        midpoint = await getMidpointOnRoad(origin, location);
    }

    // 3. Multi-point Fact Gathering (Two-Track DB)
    // Track A: Destination Core Facts (Radius 15km)
    const destCandidates = await fetchHighTrustCandidates(location.lat, location.lng);

    // Track B: Journey / Midpoint Facts (Radius 5~10km around route)
    let journeyCandidates: FactCard[] = [];
    if (midpoint) {
        const midpointFacts = await fetchHighTrustCandidates(midpoint.lat, midpoint.lng);
        // 중간 지점에서는 식당과 카페 위주로 추출
        journeyCandidates = midpointFacts.filter(f => f.category === 'RESTAURANT' || f.category === 'ROUTE_CAFE' || f.category === 'SPOT');
    }

    // 4. Categorical Selection (Track A: 15 Core Slots, Track B: 3~6 slots)
    const activeFacts: FactCard[] = [];
    const alternatives: Record<string, FactCard[]> = {};
    const destCategories: FactCard['category'][] = ['MART_HOSPITAL', 'RESTAURANT', 'SPOT', 'FESTIVAL'];

    // --- Fill Track A ---
    destCategories.forEach(cat => {
        let catFacts = destCandidates.filter(f => f.category === cat);
        // 날씨/페르소나 연동 가중치 재계산 (간소화)
        if (weatherSummary.includes('비') && cat === 'RESTAURANT') {
            catFacts.forEach(f => { if (f.name.includes('탕') || f.name.includes('찌개') || f.name.includes('국밥')) f.trustScore += 30; });
        }
        if (weatherSummary.includes('비') && cat === 'SPOT') {
            catFacts.forEach(f => { if (f.name.includes('박물관') || f.name.includes('실내') || f.name.includes('미술관')) f.trustScore += 30; });
        }
        // 동계 실내등유 1순위 견인 (11월~3월 또는 최저기온 5도 이하)
        const isWinterOrCold = weatherSummary.includes('~-') || weatherSummary.includes('~0') || weatherSummary.includes('~1') || weatherSummary.includes('~2') || weatherSummary.includes('~3') || weatherSummary.includes('~4') || weatherSummary.includes('~5');
        if (isWinterOrCold && cat === 'MART_HOSPITAL') {
            catFacts.forEach(f => { if (f.name.includes('주유소') || f.description.includes('등유')) f.trustScore += 100; });
        }

        // 아이 동반 페르소나 (소아과/돈까스 가중치)
        if (context.guestDetails?.kids && (context.guestDetails.kids.preschool > 0 || context.guestDetails.kids.elementary > 0)) {
            catFacts.forEach(f => {
                if (cat === 'MART_HOSPITAL' && (f.name.includes('소아') || f.name.includes('아동'))) f.trustScore += 50;
                if (cat === 'RESTAURANT' && f.name.includes('돈까스')) f.trustScore += 20;
            });
        }

        // 대형마트 일요일/장기 숙박 방어 및 하나로마트 격상
        const isSundayIncluded = startDate.getDay() === 0 || endDate.getDay() === 0 || (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24) >= 7;
        if (isSundayIncluded && cat === 'MART_HOSPITAL') {
            catFacts.forEach(f => {
                if (f.name.includes('이마트') || f.name.includes('홈플러스')) f.trustScore -= 40;
                if (f.name.includes('하나로마트')) f.trustScore += 30;
            });
        }

        const sorted = catFacts.sort((a, b) => b.trustScore - a.trustScore);
        const unique = Array.from(new Set(sorted.map(s => s.id))).map(id => sorted.find(s => s.id === id)!);

        if (unique.length > 0) {
            activeFacts.push(unique[0]); // 1위
            alternatives[cat] = unique.slice(1, 4); // 대안 2~3개 보관
        }
    });

    // --- Fill Track B (Route Facts) ---
    const routeFacts: FactCard[] = [];
    if (journeyCandidates.length > 0) {
        const sortedRoute = journeyCandidates.sort((a, b) => b.trustScore - a.trustScore);
        const uniqueRoute = Array.from(new Set(sortedRoute.map(s => s.id))).map(id => sortedRoute.find(s => s.id === id)!);
        // 경로상 식당/카페 3순위까지 추출
        routeFacts.push(...uniqueRoute.slice(0, 3));
    }

    // 5. AI Narration with Dual-Weather and Journey Context (3-Part Prompt)
    let narration = "";
    try {
        const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!geminiKey) throw new Error("Missing Gemini API Key");

        const prompt = `
당신은 '라온아이'의 수석 캠핑 플래너입니다. 사용자의 도착지(캠핑장)뿐만 아니라 이동 여정 전체를 고려하여 따뜻하고 감성적인 서사를 작성하세요.

[여정 컨텍스트]
- 전체 날씨 요약: ${weatherSummary}
- 성향(페르소나): ${context.description} (아이 동반 여부 확인)

아래 3가지 타임라인 컨텍스트로 나누어 팩트를 기반으로 자연스러운 스토리를 연결해주세요:

[Context 1: 가는 길 추천]
${routeFacts.length > 0 ? routeFacts.map(f => `- [${f.category}] ||${f.id}|${f.name}||: ${f.description}`).join('\n') : '중간 경로 추천 장소가 없습니다. 조심히 바로 오세요.'}

[Context 2: 캠핑장 주변 현지 추천]
${activeFacts.map(f => `- [${f.category}] ||${f.id}|${f.name}||: ${f.description}`).join('\n')}

[Context 3: 오는 길 추천]
(가는 길 추천 장소 중 마음에 드는 곳을 귀가하실 때 들러도 좋습니다.)

[작성 지침]
1. 장소 이름 언급 시 무조건 ||ID|이름|| 형식을 지켜주세요.
2. 날씨 정보를 활용하여 (예: "비가 오니 국물 요리 ||ID|xx식당||을 추천합니다", "밤 기온이 떨어지니 ||ID|xx주유소||에서 등유를 꼭 챙기세요") 실용적 조언을 포함하세요.
3. 길게 늘어놓지 말고 흐름이 자연스러운 3문단 정도의 수필 형식으로 작성하세요.
`.trim();

        console.log("\n=======================================================");
        console.log("🚀 [PIPELINE STEP 3] Midpoint Calculated: ", midpoint ? `Lat ${midpoint.lat}, Lng ${midpoint.lng}` : "None");
        console.log(`🚀 [PIPELINE STEP 5-7] Active Track A Local Facts: ${activeFacts.length} ea`);
        console.log(`🚀 [PIPELINE STEP 5-7] Active Track B Route Facts: ${routeFacts.length} ea`);
        console.log("🚀 [PIPELINE STEP 8] AI Prompt Assembled:");
        console.log(prompt);
        console.log("=======================================================\n");

        const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const apiData = await apiRes.json();
        if (apiData.candidates && apiData.candidates[0]?.content?.parts[0]?.text) {
            narration = apiData.candidates[0].content.parts[0].text;
        } else {
            console.error("Gemini API Error Response:", JSON.stringify(apiData));
            throw new Error("Invalid Gemini API response");
        }
    } catch (e) {
        console.error("AI Narration Failed:", e);
        narration = "캠퍼님을 위한 특별한 여정이 준비되었습니다. 이동 경로에서 가볍게 들를 수 있는 카페와, 현지 캠핑장 주변의 든든한 마트, 식당, 병원 리스트를 확인해 보세요.";
    }

    return {
        "@context": "https://schema.org",
        "@type": "ItemList",
        narration,
        itemListElement: activeFacts,
        routeListElement: routeFacts,
        alternatives
    };
}

export async function generatePersonalizedSmartPlan(
    userId: string | undefined,
    location: { lat: number; lng: number },
    startDate: Date,
    endDate: Date,
    origin?: { lat: number; lng: number }
): Promise<StandardizedPlanJSON> {
    try {
        const persona = await extractUserPersona(userId);
        return await generateSmartPlan(persona, location, startDate, endDate, origin);
    } catch (err) {
        console.error("Smart Plan generation wrapper failed:", err);
        return {
            "@context": "https://schema.org",
            "@type": "ItemList",
            narration: "여정 정보를 불러오는데 잠시 문제가 발생했습니다. 기본 추천 리스트를 확인해주세요.",
            itemListElement: [],
            alternatives: {}
        };
    }
}
