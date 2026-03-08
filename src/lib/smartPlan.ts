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
    trustScore: number;
    distanceKm?: number;
    metadata: Record<string, any>;
    provenance: {
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

    // 4. Fill Track B (Day 1 logic)
    const routeFacts: FactCard[] = [];
    ['ROUTE_RESTAURANT', 'ROUTE_CAFE', 'ROUTE_SPOT'].forEach(cat => {
        let catFacts = journeyCandidates.filter(f => f.category === cat);

        if (day1Weather.includes('비')) {
            if (cat === 'ROUTE_RESTAURANT') {
                catFacts.forEach(f => { if (f.name.includes('탕') || f.name.includes('찌개') || f.name.includes('칼국수') || f.name.includes('국밥')) f.trustScore += 40; });
            }
            if (cat === 'ROUTE_SPOT') {
                catFacts.forEach(f => { if (f.name.includes('박물관') || f.name.includes('실내') || f.name.includes('미술관')) f.trustScore += 40; });
            }
        }

        if (catFacts.length > 0) {
            const sorted = catFacts.sort((a, b) => b.trustScore - a.trustScore);
            routeFacts.push(sorted[0]); // Pick top 1 from each Route Category
        }
    });

    // 5. Fill Track A (Day 2/3 logic)
    const activeFacts: FactCard[] = [];
    const alternatives: Record<string, FactCard[]> = {};
    const destCategories: FactCard['category'][] = ['HOSPITAL', 'MART', 'RESTAURANT', 'GAS_STATION', 'SPOT', 'FESTIVAL'];

    destCategories.forEach(cat => {
        let catFacts = destCandidates.filter(f => f.category === cat);

        // Day 2/3 Weather Logic
        const destWeatherHasRain = day2Weather.includes('비') || day3Weather.includes('비');
        const destWeatherIsClear = day2Weather.includes('맑음') || day3Weather.includes('맑음');

        if (destWeatherHasRain) {
            if (cat === 'RESTAURANT') {
                catFacts.forEach(f => { if (f.name.includes('전골') || f.name.includes('찌개') || f.name.includes('국밥')) f.trustScore += 30; });
            }
            if (cat === 'SPOT') {
                catFacts.forEach(f => { if (f.name.includes('박물관') || f.name.includes('실내') || f.name.includes('미술관')) f.trustScore += 30; });
            }
        }
        if (destWeatherIsClear) {
            if (cat === 'RESTAURANT') {
                catFacts.forEach(f => { if (f.name.includes('막국수') || f.name.includes('냉면') || f.name.includes('구이')) f.trustScore += 20; });
            }
            if (cat === 'SPOT') {
                catFacts.forEach(f => { if (f.name.includes('수목원') || f.name.includes('둘레길') || f.name.includes('계곡') || f.name.includes('야외')) f.trustScore += 30; });
            }
        }

        if (isWinterOrCold && cat === 'GAS_STATION') {
            catFacts.forEach(f => { if (f.name.includes('주유소') || f.description?.includes('등유')) f.trustScore += 100; });
        }

        if (context.guestDetails?.kids && (context.guestDetails.kids.preschool > 0 || context.guestDetails.kids.elementary > 0)) {
            if (cat === 'HOSPITAL') {
                catFacts.forEach(f => { if (f.name.includes('소아') || f.name.includes('아동')) f.trustScore += 50; });
            }
            if (cat === 'RESTAURANT') {
                catFacts.forEach(f => { if (f.name.includes('돈까스') || f.name.includes('어린이')) f.trustScore += 20; });
            }
        }

        // Sunday / Long trip defense
        const isSundayIncluded = startDate.getDay() === 0 || endDate.getDay() === 0 || tripDays >= 7;
        if (isSundayIncluded && cat === 'MART') {
            catFacts.forEach(f => {
                if (f.name.includes('이마트') || f.name.includes('홈플러스') || f.name.includes('롯데마트')) f.trustScore -= 40;
                if (f.name.includes('하나로마트')) f.trustScore += 30;
            });
        }

        const sorted = catFacts.sort((a, b) => b.trustScore - a.trustScore);
        const unique = Array.from(new Set(sorted.map(s => s.id))).map(id => sorted.find(s => s.id === id)!);

        if (unique.length > 0) {
            activeFacts.push(unique[0]);
            alternatives[cat] = unique.slice(1, 3); // next 2 per category (Total 12 alternatives)
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
`.trim();

        // console debugging points
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
