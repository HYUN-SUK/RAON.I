// ========================================================================================
// Smart Camping Plan Phase 1: Guided Journey Headless Engine
// ========================================================================================
import { UserPersona, extractUserPersona } from './persona';
import { getForecast } from '@/lib/weather';
import { groupAndScorePlaces, RawPlace } from './reliability';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'node:crypto';

export interface StandardizedPlanJSON {
    "@context": "https://schema.org",
    "@type": "ItemList",
    narration: string;
    itemListElement: FactCard[]; // Track A: Destination Core Facts
    routeListElement?: FactCard[]; // Track B: Journey (Route/Midpoint) Facts
    featuredFestival?: FactCard[];  // v2.1: FESTIVAL featured 슬롯 (일정 겹침 시만)
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
    verificationStatus?: 'VERIFIED' | 'UNVERIFIED';
    roleName?: string;       // 여정 내 역할명 (예: "가는 길 점심")
    evidence?: {
        stars?: number;
        reviews?: number;
        badges?: string[];          // ["백년가게", "모범음식점"]
        sourceLabel?: string;       // "SMBA_BAEK", "MASTER_ENRICHED"
        certifications: string[];
        verifiedAt?: string | null;
        verificationStatus?: 'VERIFIED' | 'UNVERIFIED';
    };
    riskFlags?: string[];            // ["SUNDAY_BIG_MART", "UNVERIFIED", "MISSING_DESC"]
    selectionTier?: 'PRIMARY' | 'ALTERNATIVE' | 'FEATURED' | 'HIDDEN';
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

// v2.1: 카테고리별 1차 후보 상한 (도시 근처에서 식당이 전체를 독점하는 것을 방지)
const CATEGORY_SHORTLIST_CAP: Record<string, number> = {
    HOSPITAL: 20,
    MART: 20,
    GAS_STATION: 15,
    RESTAURANT: 40,
    SPOT: 20,
    FESTIVAL: 10,
    ROUTE_RESTAURANT: 20,
    ROUTE_CAFE: 20,
    ROUTE_SPOT: 20,
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
    // official_cert (0~50): 공공 인증 기반
    let cert = 10;
    const s = f.provenance.sourceName;
    if (s === 'SMBA_BAEK') cert = 45;
    if (s === 'SAFE_RESTAURANT' || s === 'MOIS_GOOD_RESTAURANT') cert = 35;
    if (s === 'NMC_HOSPITAL') cert = 30;
    if (s === 'OPINET') cert = 40;
    if (s === 'TOUR_SPOT' || s === 'TOUR_CAFE') cert = 25;

    // v2.1: live_rating (0~50) — 실제 별점 기반 세분화
    let live = 0;
    const stars = f.metadata?.raw_data?.scraping?.rating || f.evidence?.stars;
    if (stars && stars > 0) {
        if (stars >= 4.5) live = 50;
        else if (stars >= 4.2) live = 40;
        else if (stars >= 4.0) live = 30;
        else if (stars >= 3.8) live = 20;
        else live = 10; // 별점 확인은 됐지만 낮은 경우
    } else if (s === 'MASTER_ENRICHED') {
        live = 40; // 카카오 검증됐지만 별점 파싱 실패 시 기존값 유지
    } else {
        live = 0; // 데이터 없음
    }

    // Reliability Bonus (Group & Weight)
    const certBonus = f.metadata?.certificationBonus || 0;

    return Math.min(100, cert + live + certBonus);
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
    const riskFlags: string[] = [];
    const s = f.provenance.sourceName;

    // 일요일 대형마트 휴무 위험 (-15)
    if (isSundayIncluded && f.category === 'MART'
        && f.name.match(/이마트|홈플러스|롯데마트/)) {
        penalty += 15;
        riskFlags.push('SUNDAY_BIG_MART');
    }

    // v2.1: 미검증 감점 세분화 — 공공출처는 경감, 일반출처만 -5
    const TRUSTED_PUBLIC = ['MASTER_ENRICHED', 'NMC_HOSPITAL', 'SMBA_BAEK', 'SAFE_RESTAURANT'];
    const SEMI_PUBLIC = ['OPINET', 'MOIS_GOOD_RESTAURANT', 'TOUR_SPOT', 'TOUR_CAFE', 'TOUR_FSTVL'];
    if (!TRUSTED_PUBLIC.includes(s)) {
        if (SEMI_PUBLIC.includes(s)) {
            penalty += 2; // 공공 인증 출처이나 실시간 미검증
            riskFlags.push('SEMI_PUBLIC_UNVERIFIED');
        } else {
            penalty += 5; // 일반 출처 + 미검증
            riskFlags.push('UNVERIFIED');
        }
    }

    // v2.1: 필수 필드 누락 감점 (이름/좌표/카테고리/출처)
    let missingFields = 0;
    if (!f.name) missingFields++;
    if (!f.distanceKm && f.distanceKm !== 0) missingFields++;
    if (!f.category) missingFields++;
    if (!s) missingFields++;
    if (missingFields >= 3) { penalty += 10; riskFlags.push('SEVERE_MISSING_FIELDS'); }
    else if (missingFields >= 2) { penalty += 5; riskFlags.push('MISSING_FIELDS'); }

    // 설명 매우 빈약 (-2)
    if (!f.description || f.description.length < 3) {
        penalty += 2;
        riskFlags.push('WEAK_DESC');
    }

    f.riskFlags = riskFlags;
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
    f.trustScore = finalScore + bonus;

    // --- v2.1 Phase 2: Evidence & Verification ---
    const s = f.provenance.sourceName;
    const VERIFIED_SOURCES = ['MASTER_ENRICHED', 'NMC_HOSPITAL', 'SMBA_BAEK', 'SAFE_RESTAURANT'];
    f.verificationStatus = VERIFIED_SOURCES.includes(s) ? 'VERIFIED' : 'UNVERIFIED';

    const evidence: FactCard['evidence'] = { certifications: [], badges: [], sourceLabel: s };
    if (s === 'SMBA_BAEK') { evidence.certifications.push('중기부 백년가게'); evidence.badges!.push('백년가게'); }
    if (s === 'SAFE_RESTAURANT') { evidence.certifications.push('농식품부 안심식당'); evidence.badges!.push('안심식당'); }
    if (s === 'MOIS_GOOD_RESTAURANT') { evidence.certifications.push('행안부 모범음식점'); evidence.badges!.push('모범음식점'); }
    if (s === 'NMC_HOSPITAL') { evidence.certifications.push('응급의료기관'); evidence.badges!.push('응급의료기관'); }
    if (s === 'OPINET') evidence.badges!.push('공인주유소');

    // Kakao Scraping Data 추출
    const scraping = f.metadata?.raw_data?.scraping;
    if (scraping && scraping.success) {
        evidence.stars = scraping.rating;
        evidence.reviews = scraping.reviewCount;
        evidence.verifiedAt = new Date().toISOString();
        evidence.verificationStatus = 'VERIFIED';
        f.verificationStatus = 'VERIFIED'; // 스크래핑 성공 시 상태 승격
    } else {
        evidence.verificationStatus = VERIFIED_SOURCES.includes(s) ? 'VERIFIED' : 'UNVERIFIED';
    }

    // Merge multi-source evidence
    if (f.metadata?.badges) {
        evidence.badges = Array.from(new Set([...(evidence.badges || []), ...f.metadata.badges]));
    }
    if (f.metadata?.certifications) {
        evidence.certifications = Array.from(new Set([...(evidence.certifications || []), ...f.metadata.certifications]));
    }

    f.evidence = evidence;

    // Role Name Mapping
    const ROLE_MAP: Record<string, string> = {
        'ROUTE_RESTAURANT': '가는 길 식사',
        'ROUTE_CAFE': '여정의 쉼표',
        'ROUTE_SPOT': '기분 전환 명소',
        'HOSPITAL': '안전 가디언',
        'MART': '든든한 보급소',
        'GAS_STATION': '따뜻한 온도(등유)',
        'RESTAURANT': '캠핑장 맛집',
        'SPOT': '현지 명소',
        'FESTIVAL': '로컬 축제'
    };
    f.roleName = ROLE_MAP[f.category] || '추천 장소';

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
                limit_count: 200 // v2.1: 후보 회수량 확대 (recall 중심) → 4축 점수로 정밀 선별
            });
            if (masterErr) console.error("Master RPC Error:", masterErr);

            const combinedRaw = [...(dynamicData || []), ...(masterData || [])];
            
            // Reliability Engine 적용: 그룹화 및 보너스 점수 산출
            const groupedFacts = groupAndScorePlaces(combinedRaw as RawPlace[]);

            if (currentRadius === 15000) {
                facts = groupedFacts;
            } else {
                // 이미 있는 장소(이름+주소) 중복 제거 로직 강화
                const existingKeys = new Set(facts.map(f => `${f.name}|${f.address}`));
                const newFacts = groupedFacts.filter((f: any) => !existingKeys.has(`${f.name}|${f.address}`));
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
                address: row.address || '',
                trustScore: row.totalTrustScore || row.trust_score || 50,
                distanceKm: row.distance_meters ? parseFloat((row.distance_meters / 1000).toFixed(1)) : 0,
                metadata: { 
                  ...(row.raw_data || {}), 
                  certificationBonus: row.certificationBonus,
                  badges: row.badges,
                  certifications: row.certifications
                },
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

    // 5. Fill Track A (Day 2/3 - 현지) — v2.1 4축 점수 적용
    const activeFacts: FactCard[] = [];
    const alternatives: Record<string, FactCard[]> = {};
    // v2.1: FESTIVAL은 정규 경쟁에서 분리 → featured 슬롯으로 독립 처리
    const destCategories: FactCard['category'][] = ['HOSPITAL', 'MART', 'RESTAURANT', 'GAS_STATION', 'SPOT'];
    const destMaxDist = Math.max(...destCandidates.map(f => f.distanceKm || 0), 1);

    // Day 2/3 날씨 합산 (둘 중 하나라도 비/맑음이면 적용)
    const destWeather = [day2Weather, day3Weather].find(w => w.includes('비'))
        || [day2Weather, day3Weather].find(w => w.includes('맑음'))
        || '중립';

    destCategories.forEach(cat => {
        let catFacts = destCandidates.filter(f => f.category === cat);

        // v2.1: 카테고리별 상한 적용 (trust_score 기준 정렬 후 cap)
        const cap = CATEGORY_SHORTLIST_CAP[cat] || 20;
        if (catFacts.length > cap) {
            catFacts = catFacts.sort((a, b) => b.trustScore - a.trustScore).slice(0, cap);
        }

        // v2.1: 4축 점수 계산 (Day2/3 날씨 기준)
        catFacts = catFacts.map(f => computeFinalScore(
            f, destWeather, isWinterOrCold, hasKids, isSundayIncluded, destMaxDist
        ));

        const sorted = catFacts.sort((a, b) => b.trustScore - a.trustScore);
        const unique = Array.from(new Set(sorted.map(s => s.id))).map(id => sorted.find(s => s.id === id)!);

        if (unique.length > 0) {
            unique[0].selectionTier = 'PRIMARY';
            activeFacts.push(unique[0]);
            alternatives[cat] = unique.slice(1, 3).map(f => { f.selectionTier = 'ALTERNATIVE'; return f; });
        }
    });

    // v2.1: FESTIVAL featured 슬롯 — 칠핑 일정 겹침 시만 포함
    let featuredFestival: FactCard[] = [];
    const festivalCandidates = destCandidates.filter(f => f.category === 'FESTIVAL');
    if (festivalCandidates.length > 0) {
        // 축제 날짜와 캐핑 일정 겹침 여부 확인 (날짜 정보 없으면 일단 포함)
        const scoredFestivals = festivalCandidates.map(f => computeFinalScore(
            f, destWeather, isWinterOrCold, hasKids, isSundayIncluded, destMaxDist
        ));
        featuredFestival = scoredFestivals
            .sort((a, b) => b.trustScore - a.trustScore)
            .slice(0, 2)
            .map(f => { f.selectionTier = 'FEATURED'; f.roleName = '투데이 로컬 축제'; return f; });
    }

    // 6. AI Narration with 3-Part Timeline Prompt
    let narration = "";
    try {
        const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!geminiKey) throw new Error("Missing Gemini API Key");

        // v2.1: AI에게 전달할 장소 정보를 evidence 기반으로 풍부하게 구성
        const formatFactForAI = (f: FactCard): string => {
            const ev = f.evidence;
            const starInfo = ev?.stars ? ` (별점 ${ev.stars}점, 리뷰 ${ev?.reviews || 0}건)` : '';
            const badge = ev?.badges?.length ? ` [${ev.badges.join(', ')}]` : '';
            const vStatus = f.verificationStatus === 'VERIFIED' ? ' ✅검증완료' : ' ⚠문의권장';
            return `- [${f.category}] ||${f.id}|${f.name}||: ${f.description}${starInfo}${badge}${vStatus}`;
        };

        const routeContext = routeFacts.length > 0
            ? routeFacts.map(formatFactForAI).join('\n')
            : '중간 경로 데이터가 없습니다. 조심히 바로 오시길 안내해주세요.';
        const destContext = activeFacts.map(formatFactForAI).join('\n');
        const festivalContext = featuredFestival.length > 0
            ? '\n[Context 2.5: 지역 축제/행사]\n' + featuredFestival.map(f => `- [🎉FESTIVAL] ||${f.id}|${f.name}||: ${f.description}`).join('\n')
            : '';

        const prompt = `
당신은 '라온아이'의 수석 캠핑 플래너입니다.

[여정 기본 정보]
- 전체 날씨 요약: ${weatherSummary}
- 성향(페르소나): ${context.description}

위 일자별 날씨와 페르소나를 완벽히 반영하여 아래 3가지 타임라인 컨텍스트로 나누어 가장 감성적이고 따뜻한 여정 서사를 작성해주세요. 각 일자에 맞는 날씨를 언급하며 자연스럽게 추천 장소를 이유와 함께 연결하세요.

[Context 1: 가는 길 추천]
${routeContext}

[Context 2: 캠핑장 주변 현지 추천]
${destContext}
${festivalContext}

[Context 3: 오는 길 추천]
(위 가는 길 추천 중 선택하지 못한 대안이나 가벼운 명소를 귀갓길 컨텍스트로 따뜻하게 제안해주세요. 특히 별점이 높고 검증된 장소가 있다면 그 이유를 강조하세요. 맑은 날씨라면 뷰 좋은 카페를 추천해도 좋습니다.)

[작성 지침 (엄격 준수)]
1. 장소 이름 언급 시 무조건 ||ID|이름|| 규격을 지켜주세요.
2. 팩트 데이터의 '별점', '리뷰' 정보를 적극 인용하여 "이곳은 평점이 4.5점으로 아주 높아요" 같은 구체적인 신뢰감을 제공하세요.
3. [verificationStatus 규칙] ✅검증완료 장소만 "검증된" 표현을 사용하세요. ⚠문의권장 장소는 "방문 전 확인 권장" 수준으로만 표현하세요.
4. [금지 규칙] 영업시간, 메뉴 가격, 실시간 잔여석 정보는 데이터에 명시되지 않았다면 절대로 임의로 지어내지 마세요.
5. [톤 가이드] 휴무 위험 등 리스크 언급 시 "방문 전 전화를 통해 운영 여부를 한 번 더 확인하시면 더 완벽한 여정이 될 거예요"와 같이 부드러운 권유형을 사용하세요.
6. 길지 않은 3문단의 수필 형식으로 작성하세요.
7. 만약 추천 장소에 병원(HOSPITAL) 정보가 포함되지 않았다면, 응급 상황 발생 시 119 구급대를 이용하거나 가장 가까운 시내 의료기관으로 이동하도록 따뜻하게 안내를 포함해주세요.
8. [최종 원칙] 서사는 사용자의 편안함과 동선 부담 감소를 먼저 말하세요.
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
        featuredFestival: featuredFestival.length > 0 ? featuredFestival : undefined,
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
