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

    // 3. Multi-point Fact Gathering
    const destCandidates = await fetchHighTrustCandidates(location.lat, location.lng);
    let journeyCandidates: FactCard[] = [];

    if (midpoint) {
        const midpointFacts = await fetchHighTrustCandidates(midpoint.lat, midpoint.lng);
        // 중간 지점에서는 식당과 카페 위주로 추출
        journeyCandidates = midpointFacts.filter(f => f.category === 'RESTAURANT' || f.category === 'ROUTE_CAFE');
    } else if (origin) {
        const originFacts = await fetchHighTrustCandidates(origin.lat, origin.lng);
        journeyCandidates = originFacts.filter(f => f.category === 'ROUTE_CAFE');
    }

    const allCandidates = [...destCandidates, ...journeyCandidates];

    // 4. Categorical Selection (Top-1 Active, Top-2 Alternatives)
    const activeFacts: FactCard[] = [];
    const alternatives: Record<string, FactCard[]> = {};
    const categories: FactCard['category'][] = ['ROUTE_CAFE', 'MART_HOSPITAL', 'RESTAURANT', 'SPOT', 'FESTIVAL'];

    categories.forEach(cat => {
        let catFacts = allCandidates.filter(f => f.category === cat);

        // 정렬 및 중복 제거
        const sorted = catFacts.sort((a, b) => b.trustScore - a.trustScore);
        const unique = Array.from(new Set(sorted.map(s => s.id))).map(id => sorted.find(s => s.id === id)!);

        if (unique.length > 0) {
            activeFacts.push(unique[0]);
            alternatives[cat] = unique.slice(1, 3);
        }
    });

    // 5. AI Narration with Dual-Weather and Journey Context
    let narration = "";
    try {
        const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!geminiKey) throw new Error("Missing Gemini API Key");

        const prompt = `
당신은 '라온아이'의 캠핑 플래너입니다. 아래 여정 정보와 장소들을 바탕으로 풍부한 여행 에세이 형태의 서사를 작성하세요.

[여정 컨텍스트]
- 출발지 좌표: ${origin ? `${origin.lat}, ${origin.lng}` : '정보 없음'}
- 도착지(캠핑장): ${location.lat}, ${location.lng}
- 일정: ${startDate.toLocaleDateString()} ~ ${endDate.toLocaleDateString()}
- 전체 날씨 정보: ${weatherSummary}
- 페르소나: ${context.description} (인원: 성인 ${context.guestDetails?.adults})

[엄선된 장소 (반드시 모두 포함)]
${activeFacts.map(f => `- [${f.category}] ${f.name}: ${f.description}`).join('\n')}

[작성 규칙]
1. 출발지에서 캠핑장으로 향하는 '왕복 여정'의 설렘과 현지에서의 즐거움을 연결하세요.
2. 날씨 정보를 적극 활용하여 (예: "밤에는 추우니 등유를 준비하세요") 실질적인 조언을 섞으세요.
3. 장소 언급 시 반드시 ||ID|이름|| 형식을 지켜주세요.
4. 따뜻한 존댓말로 작성하세요.
`.trim();

        // Direct fetch to Gemini API to avoid SDK version mismatch
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
        narration = "캠퍼님을 위한 특별한 여정이 준비되었습니다. 경로상의 추천 장소와 캠핑장 주변의 팩트들을 확인해보세요! ||" +
            (activeFacts[0]?.id || "") + "|" + (activeFacts[0]?.name || "추천장소") + "|| 등 엄선된 장소들이 기다리고 있습니다.";
    }

    return {
        "@context": "https://schema.org",
        "@type": "ItemList",
        narration,
        itemListElement: activeFacts,
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
