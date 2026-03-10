// ========================================================================================
// Smart Camping Plan Phase 1: Guided Journey Headless Engine
// ========================================================================================
import { UserPersona, extractUserPersona } from './persona';
import { getForecast } from '@/lib/weather';

export interface StandardizedPlanJSON {
    "@context": "https://schema.org",
    "@type": "ItemList",
    narration: string;
    itemListElement: FactCard[]; // Track A: Destination Core Facts (18 slots)
    routeListElement?: FactCard[]; // Track B: Journey (Route/Midpoint) Facts (3 slots)
    alternatives: Record<string, FactCard[]>;
}

export interface FactCard {
    "@type": string;
    id: string;
    category: 'ROUTE_CAFE' | 'ROUTE_RESTAURANT' | 'ROUTE_SPOT' | 'HOSPITAL' | 'MART' | 'RESTAURANT' | 'GAS_STATION' | 'SPOT' | 'FESTIVAL';
    name: string;
    description: string;
    trustScore: number; // 하위 호환: finalScore로 채워짐
    scoreBreakdown?: {
        existence: number;    // 0~100: 출처 신뢰도 + 좌표 신뢰도
        quality: number;      // 0~100: 공공 인증 + 실시간 평점
        contextFit: number;   // 0~100: 날씨 적합 + 페르소나 적합
        logistics: number;    // 0~100: 거리 접근성
        riskPenalty: number;  // 0~40: 리스크 감점
        finalScore: number;   // 가중합 - 페널티
    };
    distanceKm?: number;
    metadata: Record<string, any>;
    provenance: {
        sourceName: string;
        sourceUrl?: string;
    };
}

import { createClient } from '@supabase/supabase-js';

// ========================================================================================
// v2 4축 점수 체계 (Existence / Quality / ContextFit / Logistics + Risk Penalty)
// ========================================================================================

// 카테고리별 가중치: [Existence, Quality, ContextFit, Logistics]
const CATEGORY_WEIGHTS: Record<string, [number, number, number, number]> = {
    HOSPITAL: [0.40, 0.10, 0.25, 0.25],
    MART: [0.30, 0.10, 0.20, 0.40],
    GAS_STATION: [0.30, 0.10, 0.20, 0.40],
    RESTAURANT: [0.20, 0.30, 0.30, 0.20],
    SPOT: [0.20, 0.20, 0.35, 0.25],
    FESTIVAL: [0.25, 0.10, 0.40, 0.25],
    ROUTE_RESTAURANT: [0.20, 0.25, 0.20, 0.35],
    ROUTE_CAFE: [0.20, 0.20, 0.25, 0.35],
    ROUTE_SPOT: [0.20, 0.20, 0.25, 0.35],
};

function calcExistence(f: FactCard): number {
    // source_confidence (0~60)
    let src = 30;
    const s = f.provenance.sourceName;
    if (s === 'NMC_HOSPITAL' || s === 'SMBA_BAEK' || s === 'SAFE_RESTAURANT') src = 55;
    if (s === 'MOIS_GOOD_RESTAURANT') src = 50;
    if (s === 'TOUR_SPOT' || s === 'TOUR_CAFE') src = 45;
    if (s === 'OPINET') src = 55;
    if (s === 'MASTER_ENRICHED') src = 60;
    if (s === 'LARGE_STORE') src = 40;

    // geo_confidence (0~40)
    const geo = (f.distanceKm !== undefined && f.distanceKm > 0) ? 35 : 15;

    return Math.min(100, src + geo);
}

function calcQuality(f: FactCard): number {
    // official_cert (0~50)
    let cert = 10;
    const s = f.provenance.sourceName;
    if (s === 'SMBA_BAEK') cert = 45;
    if (s === 'SAFE_RESTAURANT' || s === 'MOIS_GOOD_RESTAURANT') cert = 35;
    if (s === 'NMC_HOSPITAL') cert = 30;
    if (s === 'OPINET') cert = 40;
    if (s === 'TOUR_SPOT' || s === 'TOUR_CAFE') cert = 25;

    // live_rating (0~50): 카카오 검증된 데이터는 높은 점수
    let live = 15;
    if (s === 'MASTER_ENRICHED') live = 40;

    return Math.min(100, cert + live);
}

function calcContextFit(
    f: FactCard, weather: string, isWinter: boolean, hasKids: boolean
): number {
    // weather_match (0~50)
    let wm = 25;
    if (weather.includes('비')) {
        if (f.name.match(/탕|찌개|칼국수|국밥|전골/)) wm = 45;
        if (f.name.match(/박물관|실내|미술관/)) wm = 45;
        if (f.category === 'SPOT' && !f.name.match(/박물관|실내|미술관/)) wm = 10; // 비 날 야외 명소 감점
    }
    if (weather.includes('맑음')) {
        if (f.name.match(/막국수|냉면|구이/)) wm = 40;
        if (f.name.match(/수목원|둘레길|계곡|야외/)) wm = 45;
    }
    if (isWinter && f.category === 'GAS_STATION') wm = 50;

    // persona_match (0~50)
    let pm = 25;
    if (hasKids) {
        if (f.category === 'HOSPITAL' && f.name.match(/소아|아동/)) pm = 45;
        if (f.category === 'RESTAURANT' && f.name.match(/돈까스|어린이/)) pm = 40;
    }

    return Math.min(100, wm + pm);
}

function calcLogistics(f: FactCard, maxDistanceKm: number): number {
    if (!f.distanceKm || maxDistanceKm === 0) return 50;
    const ratio = f.distanceKm / maxDistanceKm;
    return Math.max(0, Math.round(100 * (1 - ratio)));
}

function calcRiskPenalty(f: FactCard, isSundayIncluded: boolean): number {
    let penalty = 0;
    // 일요일 대형마트 휴무 위험
    if (isSundayIncluded && f.category === 'MART'
        && f.name.match(/이마트|홈플러스|롯데마트/)) penalty += 15;
    // 정보 빈약
    if (!f.description || f.description.length < 5) penalty += 5;
    // 미검증 데이터 (카카오 or 공공 직접 확인 아닌 것)
    if (f.provenance.sourceName !== 'MASTER_ENRICHED'
        && f.provenance.sourceName !== 'NMC_HOSPITAL'
        && f.provenance.sourceName !== 'SMBA_BAEK') penalty += 5;
    return Math.min(40, penalty);
}

function computeFinalScore(
    f: FactCard, weather: string, isWinter: boolean,
    hasKids: boolean, isSunday: boolean, maxDistKm: number
): FactCard {
    const existence = calcExistence(f);
    const quality = calcQuality(f);
    const contextFit = calcContextFit(f, weather, isWinter, hasKids);
    const logistics = calcLogistics(f, maxDistKm);
    const riskPenalty = calcRiskPenalty(f, isSunday);

    const w = CATEGORY_WEIGHTS[f.category] || [0.25, 0.25, 0.25, 0.25];
    const raw = existence * w[0] + quality * w[1] + contextFit * w[2] + logistics * w[3];
    const finalScore = Math.max(0, Math.round(raw - riskPenalty));

    // 일요일 하나로마트 Diversity Bonus (+5)
    let bonus = 0;
    if (isSunday && f.category === 'MART' && f.name.includes('하나로마트')) bonus = 5;

    f.scoreBreakdown = { existence, quality, contextFit, logistics, riskPenalty, finalScore: finalScore + bonus };
    f.trustScore = finalScore + bonus; // 하위 호환
    return f;
}

async function fetchHighTrustCandidates(lat: number, lng: number): Promise<FactCard[]> {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        let currentRadius = 15000;
        let facts: any[] = [];
        let rpcDynamicFn = 'get_smart_plan_facts_in_radius';
        let rpcMasterFn = 'get_master_places_in_radius';

        while (currentRadius <= 30000) {
            // 1. Fetch Dynamic Data (HOSPITAL, FESTIVAL)
            const { data: dynamicData, error: dynamicErr } = await supabase.rpc(rpcDynamicFn, {
                center_lat: lat,
                center_lng: lng,
                radius_meters: currentRadius
            });
            if (dynamicErr) console.error("Dynamic RPC Error:", dynamicErr);

            // 2. Fetch Static Master Data (RESTAURANT, MART, GAS_STATION, SPOT)
            const { data: masterData, error: masterErr } = await supabase.rpc(rpcMasterFn, {
                target_lat: lat,
                target_lng: lng,
                radius_meters: currentRadius,
                limit_count: 50
            });
            if (masterErr) console.error("Master RPC Error:", masterErr);

            const combinedRaw = [...(dynamicData || []), ...(masterData || [])];

            if (currentRadius === 15000) {
                facts = combinedRaw;
            } else {
                // 이미 있는 카테고리 뿐만 아니라, 같은 이름의 장소가 MASTER_ENRICHED로 있다면 중복 제거
                const existingNames = new Set(facts.map(f => f.name));
                const newFacts = combinedRaw.filter((f: any) => !existingNames.has(f.name));
                facts = [...facts, ...newFacts];
            }

            const presentCategories = new Set(facts.map(f => f.category));
            // Break early if we have core categories
            const hasHospital = presentCategories.has('HOSPITAL') || presentCategories.has('MART_HOSPITAL');
            const hasRestaurant = presentCategories.has('RESTAURANT');
            const hasEnriched = facts.some(f => f.api_source === 'MASTER_ENRICHED');

            if (hasHospital && hasRestaurant && (hasEnriched || currentRadius >= 20000)) {
                break;
            }
            currentRadius += 5000;
        }

        if (!facts || facts.length === 0) return [];

        return facts.map((row: any) => {
            let mappedCategory: FactCard['category'] = row.category as any;

            // Legacy DB mapping split into 6 Categories (in case old dynamic data still exists)
            if (row.category === 'MART_HOSPITAL') {
                if (row.api_source === 'NMC_HOSPITAL' || row.name.includes('병원') || row.name.includes('의원') || row.name.includes('보건소') || row.name.includes('약국')) {
                    mappedCategory = 'HOSPITAL';
                } else if (row.api_source === 'OPINET' || row.name.includes('주유소') || (row.description && row.description.includes('등유'))) {
                    mappedCategory = 'GAS_STATION';
                } else {
                    mappedCategory = 'MART';
                }
            }

            return {
                "@type": mappedCategory === 'HOSPITAL' ? 'Hospital' :
                    mappedCategory === 'RESTAURANT' ? 'Restaurant' :
                        mappedCategory === 'GAS_STATION' ? 'GasStation' :
                            mappedCategory === 'SPOT' ? 'TouristAttraction' :
                                mappedCategory === 'FESTIVAL' ? 'Festival' : 'Store',
                id: row.id,
                category: mappedCategory,
                name: row.name,
                description: row.description || '',
                trustScore: row.trust_score || 50,
                distanceKm: row.distance_meters ? parseFloat((row.distance_meters / 1000).toFixed(1)) : 0,
                metadata: row.raw_data || {},
                provenance: { sourceName: row.api_source }
            };
        });

    } catch (e) {
        console.error("Failed to fetch real candidates:", e);
        return [];
    }
}

async function getMidpointOnRoad(origin: { lat: number, lng: number }, dest: { lat: number, lng: number }): Promise<{ lat: number, lng: number } | null> {
    const apiKey = process.env.KAKAO_REST_API_KEY;
    if (!apiKey) return null;

    try {
        const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${origin.lng},${origin.lat}&destination=${dest.lng},${dest.lat}&priority=RECOMMEND`;
        const res = await fetch(url, { headers: { 'Authorization': `KakaoAK ${apiKey}` } });
        const data = await res.json();

        if (data.routes && data.routes[0] && data.routes[0].sections[0]) {
            const section = data.routes[0].sections[0];
            const roadmap = section.roads || [];
            if (roadmap.length > 0) {
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

export async function generateSmartPlan(
    context: UserPersona,
    location: { lat: number; lng: number },
    startDate: Date,
    endDate: Date,
    origin?: { lat: number; lng: number }
): Promise<StandardizedPlanJSON> {

    // 1. Weather Context Aggregation (Whole trip day-by-day)
    const tripDays = Math.ceil(Math.abs(endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;
    let weatherSummary = "";

    let day1Weather = "맑음";
    let day2Weather = "맑음";
    let day3Weather = "맑음";

    let isWinterOrCold = false;

    try {
        const weatherList = [];
        for (let i = 0; i < Math.min(tripDays, 3); i++) {
            const checkDate = new Date(startDate);
            checkDate.setDate(startDate.getDate() + i);
            const w = await getForecast(location.lat, location.lng, checkDate.toISOString().split('T')[0]);
            if (w) {
                const dayWeatherStr = `${w.sky}(${w.temp_min}~${w.temp_max}도)`;
                weatherList.push(`Day ${i + 1}: ${dayWeatherStr}`);
                if (i === 0) day1Weather = w.sky;
                if (i === 1) day2Weather = w.sky;
                if (i === 2) day3Weather = w.sky;

                if (w.temp_min <= 5) isWinterOrCold = true;
            }
        }
        if (weatherList.length > 0) weatherSummary = weatherList.join(', ');

        // Month fallback for winter (Nov ~ Mar)
        const startMonth = startDate.getMonth() + 1;
        if (startMonth >= 11 || startMonth <= 3) isWinterOrCold = true;
    } catch (e) {
        console.error("Weather Aggregation Failed:", e);
    }

    // 2. Journey Sampling (Kakao)
    let midpoint = null;
    if (origin) {
        midpoint = await getMidpointOnRoad(origin, location);
    }

    // 3. Gathering 
    const destCandidates = await fetchHighTrustCandidates(location.lat, location.lng);
    let journeyCandidates: FactCard[] = [];
    if (midpoint) {
        const midpointFacts = await fetchHighTrustCandidates(midpoint.lat, midpoint.lng);
        journeyCandidates = midpointFacts.map(f => {
            if (f.category === 'RESTAURANT') f.category = 'ROUTE_RESTAURANT';
            if (f.category === 'SPOT') f.category = 'ROUTE_SPOT';
            if ((f.category as string) !== 'ROUTE_CAFE' && f.name.includes('카페')) {
                f.category = 'ROUTE_CAFE';
            }
            return f;
        }).filter(f => f.category === 'ROUTE_RESTAURANT' || f.category === 'ROUTE_CAFE' || f.category === 'ROUTE_SPOT');
    }

    // === v2 4축 점수 체계 컨텍스트 ===
    const hasKids = !!(context.guestDetails?.kids && (context.guestDetails.kids.preschool > 0 || context.guestDetails.kids.elementary > 0));
    const isSundayIncluded = startDate.getDay() === 0 || endDate.getDay() === 0 || tripDays >= 7;

    // 4. Fill Track B (Day 1 - 가는 길) — v2 4축 점수 적용
    const routeFacts: FactCard[] = [];
    const routeMaxDist = Math.max(...journeyCandidates.map(f => f.distanceKm || 0), 1);

    ['ROUTE_RESTAURANT', 'ROUTE_CAFE', 'ROUTE_SPOT'].forEach(cat => {
        let catFacts = journeyCandidates.filter(f => f.category === cat);

        // v2: 4축 점수 계산 (Day1 날씨 기준)
        catFacts = catFacts.map(f => computeFinalScore(
            f, day1Weather, isWinterOrCold, hasKids, isSundayIncluded, routeMaxDist
        ));

        if (catFacts.length > 0) {
            const sorted = catFacts.sort((a, b) => b.trustScore - a.trustScore);
            routeFacts.push(sorted[0]);
        }
    });

    // 5. Fill Track A (Day 2/3 - 현지) — v2 4축 점수 적용
    const activeFacts: FactCard[] = [];
    const alternatives: Record<string, FactCard[]> = {};
    const destCategories: FactCard['category'][] = ['HOSPITAL', 'MART', 'RESTAURANT', 'GAS_STATION', 'SPOT', 'FESTIVAL'];
    const destMaxDist = Math.max(...destCandidates.map(f => f.distanceKm || 0), 1);

    // Day 2/3 날씨 합산 (둘 중 하나라도 비/맑음이면 적용)
    const destWeather = [day2Weather, day3Weather].find(w => w.includes('비'))
        || [day2Weather, day3Weather].find(w => w.includes('맑음'))
        || '중립';

    destCategories.forEach(cat => {
        let catFacts = destCandidates.filter(f => f.category === cat);

        // v2: 4축 점수 계산 (Day2/3 날씨 기준)
        catFacts = catFacts.map(f => computeFinalScore(
            f, destWeather, isWinterOrCold, hasKids, isSundayIncluded, destMaxDist
        ));

        const sorted = catFacts.sort((a, b) => b.trustScore - a.trustScore);
        const unique = Array.from(new Set(sorted.map(s => s.id))).map(id => sorted.find(s => s.id === id)!);

        if (unique.length > 0) {
            activeFacts.push(unique[0]);
            alternatives[cat] = unique.slice(1, 3);
        }
    });

    // 6. AI Narration with 3-Part Timeline Prompt
    let narration = "";
    try {
        const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!geminiKey) throw new Error("Missing Gemini API Key");

        const prompt = `
당신은 '라온아이'의 수석 캠핑 플래너입니다.

[여정 기본 정보]
- 전체 날씨 요약: ${weatherSummary}
- 성향(페르소나): ${context.description}

위 일자별 날씨와 페르소나를 완벽히 반영하여 아래 3가지 타임라인 컨텍스트로 나누어 가장 감성적이고 따뜻한 여정 서사를 작성해주세요. 각 일자에 맞는 날씨를 언급하며 자연스럽게 추천 장소를 이유와 함께 연결하세요.

[Context 1: 가는 길 추천]
${routeFacts.length > 0 ? routeFacts.map(f => `- [${f.category}] ||${f.id}|${f.name}||: ${f.description}`).join('\n') : '중간 경로 데이터가 없습니다. 조심히 바로 오시길 안내해주세요.'}

[Context 2: 캠핑장 주변 현지 추천]
${activeFacts.map(f => {
            const enrichedInfo = f.provenance.sourceName === 'MASTER_ENRICHED' ? " (카카오맵 별점/후기 검증 완료)" : "";
            return `- [${f.category}] ||${f.id}|${f.name}||: ${f.description}${enrichedInfo}`;
        }).join('\n')}

[Context 3: 오는 길 추천]
(위 가는 길 추천 중 선택하지 못한 대안이나 가벼운 명소를 귀갓길 컨텍스트로 따뜻하게 제안해주세요. 특히 별점이 높고 검증된 장소가 있다면 그 이유를 강조하세요. 맑은 날씨라면 뷰 좋은 카페를 추천해도 좋습니다.)

[작성 지침]
1. 장소 이름 언급 시 무조건 ||ID|이름|| 규격을 지켜주세요.
2. 각 날짜별 날씨의 차이와 팩트 데이터의 '별점', '리뷰' 정보를 적극 인용하여 "이곳은 평점이 4.5점으로 아주 높아요" 같은 구체적인 신뢰감을 제공하세요.
3. 길지 않은 3문단의 수필 형식으로 작성하세요.
4. 만약 추천 장소에 병원(HOSPITAL) 정보가 포함되지 않았다면, 응급 상황 발생 시 119 구급대를 이용하거나 가장 가까운 시내 의료기관으로 이동하도록 따뜻하게 안내를 포함해주세요.
`.trim();

        const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
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
        narration = "캠퍼님을 위한 특별한 여정이 준비되었습니다. 날씨와 성향에 맞춘 6가지 추천 리스트를 하단에서 확인해 보세요.";
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
            narration: "여정 정보를 불러오는데 잠시 문제가 발생했습니다.",
            itemListElement: [],
            alternatives: {}
        };
    }
}
