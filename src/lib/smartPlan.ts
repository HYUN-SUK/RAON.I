// ========================================================================================
// Smart Camping Plan Phase 2: Live Engine with Deep Scoring & Track B Deep Filtering
// ========================================================================================
import { UserPersona, extractUserPersona } from './persona';
import { getForecast } from '@/lib/weather';
import { createClient } from '@supabase/supabase-js';

// ========================================================================================
// Interfaces
// ========================================================================================
export interface StandardizedPlanJSON {
    "@context": "https://schema.org";
    "@type": "ItemList";
    narration: string;
    stageIntros?: Record<string, string>;  // [v11.9.25] 5단계 모듈형 연결 문구
    stage1_timeline?: string; // [v11.9.32] Stage 1 타임라인 감성 멘트
    target_date?: string;
    itemListElement: FactCard[]; // Track A: Destination Core Facts (Day 2, 3)
    routeListElement?: FactCard[]; // Track B: Journey (Route/Midpoint) Facts (Day 1)
    returnListElement?: FactCard[]; // [v11.9.25] Stage 5: 귀갓길 추천 (Track B 2위)
    featuredFestival?: FactCard[]; 
    alternatives: Record<string, FactCard[]>;
}

export interface FactCard {
    "@type": string;
    id: string;
    category: 'ROUTE_CAFE' | 'ROUTE_RESTAURANT' | 'ROUTE_SPOT' | 'HOSPITAL' | 'FACILITY' | 'MART' | 'RESTAURANT' | 'GAS_STATION' | 'SPOT' | 'FESTIVAL';
    lat: number;
    lng: number;
    name: string;
    description: string;
    reasoning?: string;
    trustScore: number;
    scoreBreakdown?: {
        baseScore: number; // DB에서 가져온 기본 품질 점수
        contextFit: number; // 날씨/페르소나 딥 스코어
        distanceBonus?: number; // Track B 거리 가점
        certBonus?: number; // 인증 가점 (백년/LX/모범/안심)
        tierBonus?: number; // 명소 티어 가점
        riskPenalty: number;
        finalScore: number;
    };
    verificationStatus?: 'VERIFIED' | 'UNVERIFIED';
    roleName?: string;
    evidence?: {
        stars?: number;
        reviews?: number;
        badges?: string[];
        certifications: string[];
        displayBadges?: { emoji: string; label: string }[];
        emojiString?: string; // 프롬프트용 (🎖️백년가게) 등
    };
    selectionTier?: 'PRIMARY' | 'ALTERNATIVE' | 'FEATURED' | 'HIDDEN';
    distanceKm?: number;
    metadata: Record<string, any>;
    provenance: {
        sourceName: string;
    };
}

// ========================================================================================
// Deep Scoring Logic (ContextFit)
// ========================================================================================

import { computePersonaMatch } from './personaBridge';

export function isCafeItem(name: string, subCategory: string = ''): boolean {
    const cafeKeywords = /카페|커피|베이커리|제과|다방|디저트|찻집|로스터리/;
    return cafeKeywords.test(name) || cafeKeywords.test(subCategory);
}

export function calcContextFitDeep(f: FactCard, weather: string, isWinter: boolean, persona: UserPersona): number {
    let score = 25; // Base contextFit
    const name = f.name || '';
    const desc = f.description || '';
    const text = name + ' ' + desc;
    
    // [v11.9.24] 카페 여부 판별
    const isCafe = isCafeItem(name, (f.metadata?.sub_category as string) || '');

    const adults = persona.guestDetails?.adults || 2;
    const seniors = persona.guestDetails?.seniors || 0;
    const preschool = persona.guestDetails?.kids?.preschool || 0;
    const elementary = persona.guestDetails?.kids?.elementary || 0;
    const hasKids = preschool > 0 || elementary > 0;
    const hasPet = persona.guestDetails?.hasPet || false;

    // 1. Weather Deep Score (기존 유지)
    if (weather.includes('비') || weather.includes('눈')) {
        if (text.match(/탕|찌개|칼국수|국밥|전골/)) score += 20;
        if (text.match(/박물관|실내|미술관/)) score += 20;
        if (f.category === 'SPOT' && !text.match(/박물관|실내|미술관/)) score -= 20;
    }
    if (weather.includes('맑음')) {
        if (text.match(/막국수|냉면|구이/)) score += 15;
        if (text.match(/수목원|둘레길|계곡|야외|산책/)) score += 15;
        // 맑은 날 카페/베이커리 가산
        if (isCafe) score += 10;
    }
    if (isWinter && f.category === 'GAS_STATION') score += 20;

    // 2. Behavior-Tag System Integration (신규 브릿지 연동)
    const tagMap = persona.tagMap || {};
    const bridgeScore = computePersonaMatch(f, tagMap);

    // 3. Strong Signal Safety Score (인원 구성 기반 보조 점수)
    let safetyScore = 0;
    if (hasKids) {
        if (f.category === 'HOSPITAL' && text.match(/소아과|아동병원/)) safetyScore += 40;
        if (text.match(/어린이|노키즈존/)) {
            if (text.includes('노키즈존')) safetyScore -= 40;
            else safetyScore += 10;
        }
    }
    if (hasPet && text.match(/애견동반|반려동물/)) safetyScore += 15;
    if (seniors > 0 && text.match(/백숙|보양식|한정식/)) safetyScore += 15;

    return Math.max(0, Math.min(100, score + bridgeScore + safetyScore));
}



export function calcQuality(p: any): number {
    return 50;
}

// ========================================================================================
// Evidence & Certifications Parser
// ========================================================================================

function buildEvidence(raw: any, category: string): FactCard['evidence'] {
    const certs: string[] = [];
    const badges: string[] = [];
    const emojis: string[] = [];
    
    // 카카오 검증 등에서 넘어온 평점
    let stars = 0;
    if (raw.kakao_rating) stars = raw.kakao_rating;
    else if (raw.scraping?.rating) stars = raw.scraping.rating;
    else if (raw.raw_data?.scraping?.rating) stars = raw.raw_data.scraping.rating;

    const source = raw.api_source || raw.sourceName || '';
    // [v11.9.26] smart_plan_candidates는 raw_data.badges에 인증 정보 저장
    const rawBadges: string[] = raw.badges || raw.raw_data?.badges || [];

    // [v11.9.26] 개별 인증 보장 및 중복 표기 로직 (api_source + raw_data.badges 통합 참조)
    if (source === 'SMBA_BAEK' || rawBadges.includes('백년가게')) {
        certs.push('중기부 백년가게'); badges.push('백년가게'); emojis.push('🎖️백년가게');
    }
    if (source === 'LX_RESTAURANT' || rawBadges.includes('LX인증맛집') || rawBadges.includes('LX인증')) {
        certs.push('LX한국국토정보공사 인증'); badges.push('LX인증'); emojis.push('🎖️LX인증');
    }
    if (source === 'MOIS_GOOD_RESTAURANT' || source === 'LOCALDATA_RESTAURANT_GOOD' || rawBadges.includes('모범음식점')) {
        certs.push('행안부 모범음식점'); badges.push('모범음식점'); emojis.push('🎖️모범음식점');
    }
    if (source === 'SAFE_RESTAURANT' || rawBadges.includes('안심식당')) {
        certs.push('농식품부 안심식당'); badges.push('안심식당'); emojis.push('🎖️안심식당');
    }
    const isHospital = category === 'HOSPITAL' || category === 'ROUTE_HOSPITAL';
    if (isHospital && (source === 'NMC_HOSPITAL' || rawBadges.includes('응급의료센터') || rawBadges.includes('응급의료기관') || raw.name?.includes('의료원') || raw.name?.match(/종합병원|응급/))) {
        certs.push('응급의료기관'); badges.push('응급의료기관'); emojis.push('🚨응급의료기관');
    }
    if (isHospital && (rawBadges.includes('종합병원') || rawBadges.includes('의료원') || rawBadges.includes('대학병원'))) {
        const hLabel = rawBadges.find(b => ['종합병원', '의료원', '대학병원'].includes(b)) || '종합병원';
        if (!certs.includes(hLabel)) { certs.push(hLabel); badges.push(hLabel); emojis.push(`🏥${hLabel}`); }
    }
    if (isHospital && (rawBadges.includes('24시 응급'))) {
        if (!certs.includes('24시 응급')) { certs.push('24시 응급'); badges.push('24시 응급'); emojis.push('🚑24시 응급'); }
    }
    const isSpot = category === 'SPOT' || category === 'ROUTE_SPOT';
    if (isSpot) {
        // [v11.9.26] raw_data.badges에서 명소 인증 정보 추출
        const spotBadge = rawBadges.find(b => ['한국관광 100선', '지역 8경'].includes(b));
        if (spotBadge) {
            certs.push(spotBadge); badges.push(spotBadge); emojis.push(`👑${spotBadge}`);
        }
        // 티어 점수가 70점 이상이면 무조건 지역명소 마크 부여
        const ts = raw.trust_score || raw.quality_score || 0;
        const fullText = (raw.name || '') + ' ' + (raw.description || '') + ' ' + (raw.raw_data?.description || '');
        const match8 = fullText.match(/([가-힣]+)\s*(8경|구경|팔경)/);
        
        if (match8 && !emojis.some(e => e.includes('경'))) {
            emojis.push(`👑${match8[1]} ${match8[2]}!`);
        } else if (ts >= 70 && !emojis.some(e => e.includes('👑'))) {
            certs.push('지역명소'); badges.push('지역명소'); emojis.push('👑지역명소');
        }
    }

    const displayBadges = certs.map((c, i) => ({
        emoji: emojis[i] || '🏅',
        label: c
    }));

    return {
        stars: stars > 0 ? stars : undefined,
        reviews: raw.kakao_reviews || raw.scraping?.reviewCount || undefined,
        certifications: certs,
        badges,
        displayBadges,
        emojiString: Array.from(new Set(emojis)).join(' ')
    };
}

function parseFactCard(row: any, mapCategory?: FactCard['category']): FactCard {
    const cat = mapCategory || row.category as FactCard['category'];
    // [v11.9.23] row 전체를 넘겨서 api_source 컬럼을 직접 참조할 수 있게 수정
    const evidence = buildEvidence(row, cat);

    // 역할 매핑
    const ROLE_MAP: Record<string, string> = {
        'ROUTE_RESTAURANT': '가는 길 식사',
        'ROUTE_CAFE': '여정의 쉼표',
        'ROUTE_SPOT': '가벼운 나들이',
        'HOSPITAL': '안전 가디언',
        'MART': '든든한 보급소',
        'GAS_STATION': '따뜻한 온도',
        'RESTAURANT': '캠핑장 맛집',
        'SPOT': '현지 명소',
        'FESTIVAL': '로컬 축제'
    };

    return {
        "@type": cat === 'HOSPITAL' ? 'Hospital' : cat.includes('RESTAURANT') ? 'Restaurant' : cat === 'SPOT' ? 'TouristAttraction' : 'Store',
        id: row.fact_id || row.id,
        category: cat,
        name: row.name,
        lat: parseFloat(row.lat) || 0,
        lng: parseFloat(row.lng) || 0,
        description: row.raw_data?.description || row.description || '',
        trustScore: row.final_score || 50,
        scoreBreakdown: {
            baseScore: row.quality_score || 50,
            contextFit: 25,
            riskPenalty: row.penalty_score || 0,
            finalScore: row.final_score || 50
        },
        verificationStatus: (evidence?.certifications?.length ?? 0) > 0 ? 'VERIFIED' : 'UNVERIFIED',
        roleName: ROLE_MAP[cat],
        evidence,
        distanceKm: row.distance_meters ? parseFloat((row.distance_meters / 1000).toFixed(1)) : 0,
        metadata: { 
            ...(row.raw_data || {}), 
            address: row.address || row.raw_data?.address 
        },
        provenance: { sourceName: row.api_source || row.raw_data?.api_source || '' }
    };
}

// ========================================================================================
// Track A: D-3 Cached Destination Candidates (from smart_plan_candidates)
// ========================================================================================

async function fetchCachedTrackA(reservationId: string, weather: string, isWinter: boolean, persona: UserPersona): Promise<FactCard[]> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
        .from('smart_plan_candidates')
        .select('*')
        .eq('reservation_id', reservationId);

    if (error || !data) {
        console.error("Track A Fetch Error:", error);
        return [];
    }

    const globalBlacklist = /정비|카센터|공업사|세차|타이어|배터리|공인중개사|부동산|장례|상조|종교|교회|사찰$|센터$|학원|관리소|사무소|지물포|건재|상사|유통|공구|이발|미용|세탁|철물|사진관|인쇄소|스튜디오|모텔|여관|호텔|약국|의원|병원|디지털/;

    const facts = data.filter(row => {
        const name = row.name || '';
        if (globalBlacklist.test(name)) return false;
        return true;
    }).map(row => {
        const f = parseFactCard(row);
        // Deep ContextFit 적용 (기존 캐싱 점수에 ContextFit 추가 병합)
        const cFit = calcContextFitDeep(f, weather, isWinter, persona);
        f.scoreBreakdown!.contextFit = cFit;
        // 최종 점수 = 캐싱된 (Quality - Penalty) + ContextFit
        f.trustScore = (row.quality_score || 50) + cFit - (row.penalty_score || 0);
        f.scoreBreakdown!.finalScore = f.trustScore;
        return f;
    });

    return facts;
}

// ========================================================================================
// Track B: Midpoint Simple Spot Deep Filtering
// ========================================================================================

async function fetchMidpointTrackB(midpoint: {lat: number, lng: number}, weather: string, isWinter: boolean, persona: UserPersona): Promise<FactCard[]> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const radiusLat = midpoint.lat;
    const radiusLng = midpoint.lng;

    // 5km 내의 마스터 장소 호출 (카카오 API 안 씀)
    const searchRadii = [5000, 10000, 15000, 20000, 25000, 30000];
    const allData: any[] = [];

    // [v11.9.24] 각 카테고리별 독립 검색 로직
    // 1. 식당 & 명소 검색 (최대 30km)
    for (const radius of searchRadii) {
        let foundAny = false;
        for (const cat of ['RESTAURANT', 'SPOT']) {
            const { data } = await supabase.rpc('get_master_places_in_radius_v2', {
                target_lat: midpoint.lat,
                target_lng: midpoint.lng,
                radius_meters: radius,
                limit_count: 30,
                p_category: cat
            });
            if (data && data.length > 0) {
                allData.push(...data);
                foundAny = true;
            }
        }
        if (foundAny) break; // 식당/명소는 발견 즉시 중단
    }

    // 2. 카페 별도 검색 (키워드 기반, 최대 30km 확장)
    const cafeRegex = /카페|커피|베이커리|빵집|디저트|로스터리|cafe|coffee|bakery|dessert/i;
    for (const radius of searchRadii) {
        const { data: cafeData } = await supabase.rpc('get_master_places_in_radius_v2', {
            target_lat: midpoint.lat,
            target_lng: midpoint.lng,
            radius_meters: radius,
            limit_count: 500, // [v11.9.26] 대폭 상향하여 카페 누락 방지
            p_category: 'RESTAURANT'
        });

        if (cafeData && cafeData.length > 0) {
            // [v11.9.26] 이름 또는 설명에 카페 키워드가 있는 것들만 선별
            const filtered = cafeData.filter((item: any) => 
                cafeRegex.test(item.name || '') || cafeRegex.test(item.description || '') || item.category === 'CAFE'
            );
            allData.push(...filtered);
            
            const uniqueCafes = new Set(allData.filter(item => 
                cafeRegex.test(item.name || '') || item.category === 'CAFE'
            ).map(i => i.id));

            if (uniqueCafes.size >= 12) break;
        }
    }

    if (allData.length === 0) return [];




    // [v11.9.23] Deduplication & Merging Logic
    const mergedMap = new Map<string, any>();
    allData.forEach((row: any) => {
        const name = row.name || '';
        const cleanAddr = (row.address || '').replace(/\s/g, '');
        const key = `${name}_${cleanAddr}`;
        if (mergedMap.has(key)) {
            const existing = mergedMap.get(key);
            if (!existing.allSources) existing.allSources = [existing.api_source];
            if (row.api_source && !existing.allSources.includes(row.api_source)) {
                existing.allSources.push(row.api_source);
            }
            if (row.badges) existing.badges = [...(existing.badges || []), ...row.badges];
            if (row.trust_score > (existing.trust_score || 0)) existing.trust_score = row.trust_score;
        } else {
            mergedMap.set(key, { ...row, allSources: [row.api_source].filter(Boolean) });
        }
    });

    const facts: FactCard[] = [];
    mergedMap.forEach((row: any) => {
        const name = row.name || '';
        const address = row.address || '';
        
        // [v11.9.32] 강력 블랙리스트 (식당이 아닌 것들 제거 + 지물포/건재/디지털/스튜디오 추가)
        const globalBlacklist = /정비|카센터|공업사|세차|타이어|배터리|공인중개사|부동산|장례|상조|종교|교회|사찰$|센터$|학원|관리소|사무소|지물포|건재|상사|유통|공구|이발|미용|세탁|철물|사진관|인쇄소|스튜디오|모텔|여관|호텔|약국|의원|병원|디지털/;
        if (globalBlacklist.test(name)) return;

        // [v11.9.32] 폐업, 블랙리스트, 과도한 페널티 데이터 원천 차단
        if (row.is_closed === true || row.is_blacklisted === true) return;
        if (row.penalty_score && row.penalty_score >= 50) return;

        const cafeRegex = /카페|커피|베이커리|빵집|디저트|로스터리|cafe|coffee|bakery|dessert/i;
        if (!['RESTAURANT', 'SPOT', 'CAFE'].includes(row.category) && !cafeRegex.test(name)) return;
        
        let cat: FactCard['category'] = 'ROUTE_SPOT';
        if (row.category === 'RESTAURANT') cat = 'ROUTE_RESTAURANT';
        if (cafeRegex.test(name) || row.category === 'CAFE') cat = 'ROUTE_CAFE';

        const f = parseFactCard({ ...row, id: row.id, fact_id: row.id, quality_score: 50, penalty_score: 0 }, cat);
        const nameDesc = (f.name + ' ' + (f.description || '')).toLowerCase();

        // [Deep Filtering]: 간단 명소 로직
        let simpleSpotBonus = 0;
        if (cat === 'ROUTE_SPOT') {
            const spotBlacklist = /산$|봉$|산맥|국립공원|도립공원|군립공원|자연휴양림|해수욕장|계곡|섬$|둘레길|트래킹|오름|테마파크|워터파크|리조트|민속촌|수목원|산성|읍성|대교|터널|IC|휴게소/;
            const whitelistRegex = /전망대|스카이워크|출렁다리|케이블카|루프탑|베이커리|휴게소|생가|기념관|미술관|박물관|문학관|정원|방조제|등대/;
            
            if (spotBlacklist.test(nameDesc)) simpleSpotBonus -= 100; // 사실상 제거
            if (whitelistRegex.test(nameDesc)) simpleSpotBonus += 40; 
        }

        // 5km 거리 페널티 (5000m = 0점, 0m = +30점)
        const dist = row.distance_meters || 5000;
        const distScore = Math.max(0, 30 * (1 - dist / 5000));

        const cFit = calcContextFitDeep(f, weather, isWinter, persona);
        
        // [v11.9.23] 중복 인증 가점 합산
        let certBonus = 0;
        const sources = row.allSources || [];
        const badges = row.badges || [];
        
        if (sources.includes('SMBA_BAEK') || badges.includes('백년가게')) certBonus += 50;
        if (sources.includes('LX_RESTAURANT')) certBonus += 50;
        if (sources.includes('MOIS_GOOD_RESTAURANT') || sources.includes('LOCALDATA_RESTAURANT_GOOD') || badges.includes('모범음식점')) certBonus += 30;
        if (sources.includes('SAFE_RESTAURANT') || badges.includes('안심식당')) certBonus += 20;
        
        // [v11.9.23] 명소 티어 반영 (1티어 100점, 2티어 80점)
        let tierBonus = 0;
        if (row.category === 'SPOT') {
            const ts = row.trust_score || 0;
            if (ts >= 90) tierBonus = 100;
            else if (ts >= 70) tierBonus = 80;
            else tierBonus = ts; // 그 외는 원래 점수 유지
        }

        f.trustScore = 50 + cFit + distScore + simpleSpotBonus + certBonus + tierBonus;
        f.scoreBreakdown = {
            baseScore: 50,
            contextFit: cFit,
            distanceBonus: distScore,
            certBonus: certBonus,
            tierBonus: tierBonus,
            riskPenalty: simpleSpotBonus < 0 ? Math.abs(simpleSpotBonus) : 0,
            finalScore: f.trustScore
        };

        if (f.trustScore > 40) { // 기준선 통과한 곳만
            facts.push(f);
        }
    });

    return facts;
}

export async function calcDistanceScore(category: string, distKm: number): Promise<number> {
    return 0;
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
            const totalDuration = section.duration; // 총 소요 시간 (초)
            const targetDuration = totalDuration / 2;
            
            let accumulatedDuration = 0;
            const roads = section.roads || [];
            
            for (const road of roads) {
                accumulatedDuration += road.duration;
                if (accumulatedDuration >= targetDuration) {
                    const coords = road.vertexes || [];
                    if (coords.length >= 2) {
                        // 해당 도로 세그먼트의 시작점을 중간 지점으로 반환
                        return { lng: coords[0], lat: coords[1] };
                    }
                }
            }
            
            // 폴백: 도로 데이터가 이상할 경우 기존 방식(가운데 도로) 사용
            if (roads.length > 0) {
                const middleRoad = roads[Math.floor(roads.length / 2)];
                const coords = middleRoad.vertexes || [];
                if (coords.length >= 2) return { lng: coords[0], lat: coords[1] };
            }
        }
        return null;
    } catch (e) {
        return null;
    }
}

// ========================================================================================
// Main Generation
// ========================================================================================

export async function generatePersonalizedSmartPlan(
    userId: string | undefined,
    location: { lat: number; lng: number },
    startDate: Date,
    endDate: Date,
    origin?: { lat: number; lng: number },
    predefinedMidpoint?: { lat: number; lng: number }
): Promise<StandardizedPlanJSON> {
    try {
        const persona = await extractUserPersona(userId);
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Find Reservation ID for Track A
        let reservationId: string | null = null;
        if (userId) {
            const formattedDate = startDate.toISOString().split('T')[0];

            // 1차: user_schedules에서 조회
            const { data: resData } = await supabase
                .from('user_schedules')
                .select('id')
                .eq('user_id', userId)
                .eq('check_in', formattedDate)
                .order('created_at', { ascending: false })
                .limit(1);
            if (resData && resData.length > 0) {
                reservationId = resData[0].id;
            }

            // 2차 Fallback: blocked_dates에서 조회
            if (!reservationId) {
                const { data: bdData } = await supabase
                    .from('blocked_dates')
                    .select('reservation_id')
                    .eq('start_date', formattedDate)
                    .limit(1);
                if (bdData && bdData.length > 0) {
                    reservationId = bdData[0].reservation_id;
                }
            }
            
            // 3차 Fallback: 날짜를 ±1일 범위로 확장 검색
            if (!reservationId) {
                const prevDate = new Date(startDate.getTime() - 86400000).toISOString().split('T')[0];
                const nextDate = new Date(startDate.getTime() + 86400000).toISOString().split('T')[0];
                const { data: expandData } = await supabase
                    .from('user_schedules')
                    .select('id, check_in')
                    .eq('user_id', userId)
                    .gte('check_in', prevDate)
                    .lte('check_in', nextDate)
                    .order('created_at', { ascending: false })
                    .limit(1);
                if (expandData && expandData.length > 0) {
                    reservationId = expandData[0].id;
                }
            }
        }

        // 2. Weather
        let weatherSummary = "맑음";
        let isWinter = false;
        let isRainy = false; // [v11.9.30] 비/눈 판정 추가
        try {
            // [v11.9.30] 다중 일자 날씨 추출 (startDate ~ endDate)
            const w = await getForecast(location.lat, location.lng, startDate.toISOString().split('T')[0]);
            if (w && w.daily && Array.isArray(w.daily)) {
                const startStr = startDate.toISOString().split('T')[0];
                const endStr = endDate.toISOString().split('T')[0];
                
                const weatherList: string[] = [];
                for (const dayForecast of w.daily) {
                    if (dayForecast.date >= startStr && dayForecast.date <= endStr) {
                        const shortDate = dayForecast.date.substring(5).replace('-', '/');
                        const isPrecipitation = dayForecast.pop >= 50 || ['rainy', 'snowy'].includes(dayForecast.weatherCode);
                        const skyText = isPrecipitation ? (dayForecast.weatherCode === 'snowy' ? '눈' : '비') : '맑음/구름';
                        
                        weatherList.push(`${shortDate}: ${skyText} (${dayForecast.min}~${dayForecast.max}도)`);
                        
                        if (dayForecast.min <= 5) isWinter = true;
                        if (isPrecipitation) isRainy = true;
                    }
                }
                if (weatherList.length > 0) {
                    weatherSummary = weatherList.join(', ');
                }
            }
        } catch(e) {}

        // 3. Track B (Midpoint / Day 1)
        const routeFacts: FactCard[] = [];
        const alternatives: Record<string, FactCard[]> = {};

        if (origin || predefinedMidpoint) {
            const midpoint = predefinedMidpoint || (origin ? await getMidpointOnRoad(origin, location) : null);
            if (midpoint) {

                const trackBFacts = await fetchMidpointTrackB(midpoint, weatherSummary, isWinter, persona);
                ['ROUTE_RESTAURANT', 'ROUTE_CAFE', 'ROUTE_SPOT'].forEach(cat => {
                    let catFacts = trackBFacts.filter(f => f.category === cat);
                    
                    // [v11.9.30] 우천 시 실내 장소(카페, 박물관 등) 가중치 +20점 부여
                    if (isRainy && cat === 'ROUTE_SPOT') {
                        catFacts = catFacts.map(f => {
                            const desc = f.description || '';
                            const isIndoor = desc.includes('박물관') || desc.includes('전시') || desc.includes('미술관') || desc.includes('실내');
                            return { ...f, trustScore: isIndoor ? f.trustScore + 20 : f.trustScore };
                        });
                    }
                    
                    catFacts.sort((a, b) => b.trustScore - a.trustScore);
                    if (catFacts.length > 0) {
                        catFacts[0].selectionTier = 'PRIMARY';
                        catFacts[0].roleName = cat === 'ROUTE_CAFE' ? '여행의 쉼표, 카페' : 
                                               cat === 'ROUTE_RESTAURANT' ? '가는 길 식사' : '가벼운 나들이';
                        routeFacts.push(catFacts[0]);
                        // [v11.9.25] 카페 12개, 식당/명소 15개 제공
                        const maxAlts = cat === 'ROUTE_CAFE' ? 12 : 15;
                        alternatives[cat] = catFacts.slice(1, maxAlts).map(f => { f.selectionTier = 'ALTERNATIVE'; return f; });
                    }
                });
            }
        }

        // 4. Track A (Destination / Day 2, 3)
        const activeFacts: FactCard[] = [];
        const featuredFestival: FactCard[] = [];
        
        if (reservationId) {
            const trackAFacts = await fetchCachedTrackA(reservationId, weatherSummary, isWinter, persona);
            
            ['HOSPITAL', 'MART', 'RESTAURANT', 'GAS_STATION', 'SPOT'].forEach(cat => {
                let catFacts = trackAFacts.filter(f => f.category === cat);
                
                // [v11.9.30] 우천 시 실내 장소 가중치 부여
                if (isRainy && cat === 'SPOT') {
                    catFacts = catFacts.map(f => {
                        const desc = f.description || '';
                        const isIndoor = desc.includes('박물관') || desc.includes('전시') || desc.includes('미술관') || desc.includes('실내');
                        return { ...f, trustScore: isIndoor ? f.trustScore + 20 : f.trustScore };
                    });
                }
                
                catFacts.sort((a, b) => b.trustScore - a.trustScore);
                if (catFacts.length > 0) {
                    catFacts[0].selectionTier = 'PRIMARY';
                    activeFacts.push(catFacts[0]);
                    // 15개 전체 제공하여 페이징 뷰 가능하게 함
                    alternatives[cat] = catFacts.slice(1, 15).map(f => { f.selectionTier = 'ALTERNATIVE'; return f; });
                }
            });

            // 축제
            const fests = trackAFacts.filter(f => f.category === 'FESTIVAL').sort((a, b) => b.trustScore - a.trustScore);
            if (fests.length > 0) {
                fests[0].selectionTier = 'FEATURED';
                fests[0].roleName = '투데이 로컬 축제';
                featuredFestival.push(fests[0]);
            }
        } else {
            // No reservation ID (Fallback or Just View)
            console.warn("No reservation ID found. Track A is empty.");
        }

        // [v11.9.26] Stage 5: 귀갓길 추천 (Track B에서 식당, 카페, 명소 1개씩 선정)
        const returnFacts: FactCard[] = [];
        ['ROUTE_RESTAURANT', 'ROUTE_CAFE', 'ROUTE_SPOT'].forEach(cat => {
            const alts = alternatives[cat];
            if (alts && alts.length > 0) {
                const returnCard = { ...alts[0], selectionTier: 'PRIMARY' as const, roleName: cat === 'ROUTE_CAFE' ? '귀갓길의 여유, 카페' : '귀갓길 추천' };
                returnFacts.push(returnCard);
            }
        });


        // 5. [v11.9.25] AI Narration with Modular 5-Stage Prompt
        let narration = "데이터를 분석하여 완벽한 여정을 짰습니다. 리스트를 스와이프하여 확인해 보세요!";
        const stageIntros: Record<string, string> = {};
        try {
            const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
            if (geminiKey) {
                const formatAI = (f: FactCard): string => {
                    const emj = f.evidence?.emojiString ? ` ${f.evidence.emojiString}` : '';
                    return `- ID:${f.id} | ${f.name}: ${f.description || '설명 없음'}${emj}`;
                };

                const allRouteCards = [...routeFacts, ...Object.values(alternatives).flat().filter(f => 
                    ['ROUTE_RESTAURANT', 'ROUTE_CAFE', 'ROUTE_SPOT'].includes(f.category)
                )];
                const routeContext = allRouteCards.length > 0 ? allRouteCards.map(formatAI).join('\n') : '없음';
                
                const allDestCards = [...activeFacts, ...Object.values(alternatives).flat().filter(f => 
                    ['RESTAURANT', 'SPOT', 'MART', 'HOSPITAL', 'GAS_STATION'].includes(f.category)
                )];
                const destContext = allDestCards.length > 0 ? allDestCards.map(formatAI).join('\n') : '없음';
                const festContext = featuredFestival.map(formatAI).join('\n');
                const returnContext = returnFacts.length > 0 ? returnFacts.map(formatAI).join('\n') : '없음';

                const prompt = `
당신은 '라온아이' 캠핑장의 전속 여행 가이드예요.
따뜻하고 친근한 해요체로, 캠핑을 떠나는 여행자에게 이야기하듯 안내해 주세요.

[조건]
- 전체 일정 날씨: ${weatherSummary} (주의: 비/눈 등 악천후나 기온을 종합적으로 고려하여 추천 근거를 설명해 주세요.)
- 여행자 구성: ${(() => {
    if (!persona.guestDetails) return persona.description;
    const { adults, kids, hasPet } = persona.guestDetails;
    const kidCount = kids.preschool + kids.elementary + kids.teen;
    return `성인 ${adults}명${kidCount > 0 ? `, 아이 ${kidCount}명` : ''}${hasPet ? ', 반려견 1마리' : ''}와 함께하는 여행 (${persona.description})`;
})()} (주의: 아이 동반, 반려견 동반 등 여행자의 인원 구성을 반드시 문장에 포함하여 '맞춤형'임을 실감나게 표현해 주세요.)

[여정 구성 (5단계)]
아래의 5단계 흐름에 맞춰서 각 단계의 시작을 알리는 인트로 문구(stageIntros)를 작성해 주세요.
- 1단계 (MANDATORY): '전체 여정 브리핑' 역할을 합니다. 반드시! 무조건! 첫 문장에 위에서 설명한 '여행자 구성(예: 아이와 함께하는 가족)'과 전체 일정의 날씨 요약(${weatherSummary})을 구체적으로 언급하며 시작하세요. "새로운 캠핑 경험을 찾아 떠나는 호기심 많은 캠퍼"와 같은 기본 멘트는 지양하고, 구체적인 인원 상황을 언급해 주세요. (예: "아이와 함께하는 이번 여행은...")
- 2~5단계: 각 단계로 넘어가는 따뜻한 연결 문구 (해요체, 시적인 표현 권장)

[장소 목록]
중요: 아래 장소들의 ID(예: ID:123)를 키로 사용하여 한 줄 소개(oneLiners)를 작성해야 합니다.

- 가는 길 및 귀갓길 관련:
${routeContext}
${returnContext}

- 캠핑장 주변 및 축제:
${destContext}
${festContext ? `\n- 축제:\n${festContext}` : ''}

[출력 규칙]
1. 반드시 아래 JSON 구조로만 응답하세요. 다른 텍스트는 포함하지 마세요.
2. stageIntros: 1단계는 '종합 브리핑 서사(150자 내외)', 2~5단계는 '여정 연결 문구' (해요체, 장소명 직접 언급 금지)
3. stage1_timeline: 타임라인 화면에 노출될 짧고 감성적인 1단계 출발 인사말 (예: "드디어 기다리던 캠핑 당일! 안전하고 즐겁게 출발해 볼까요?")
4. oneLiners: 장소 ID를 키로 하여 15~30자 이내의 한 줄 소개 작성 (해요체)

{
  "stageIntros": {
    "1": "1단계 종합 브리핑 문구",
    "2": "2단계 연결 문구",
    "3": "3단계 연결 문구",
    "4": "4단계 연결 문구",
    "5": "5단계 연결 문구"
  },
  "stage1_timeline": "1단계 타임라인 인사말",
  "oneLiners": {
    "장소ID": "설명"
  }
}
                `.trim();

                const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { 
                            response_mime_type: "application/json"
                        }
                    })
                });

                const apiData = await apiRes.json();
                const responseText = apiData.candidates?.[0]?.content?.parts?.[0]?.text;
                
                if (responseText) {
                    const parsed = JSON.parse(responseText);
                    // [v11.9.26] 키 정규화 (1, 2, 3... 또는 stage1, stage2... 대응)
                    const rawIntros = parsed.stageIntros || {};
                    Object.entries(rawIntros).forEach(([k, v]) => {
                        const numKey = k.replace(/[^0-9]/g, '');
                        if (numKey) stageIntros[numKey] = v as string;
                    });
                    
                    if (parsed.stage1_timeline) {
                        stageIntros['stage1_timeline'] = parsed.stage1_timeline;
                    }

                    const allCards = [
                        ...routeFacts, ...activeFacts, ...featuredFestival, ...returnFacts,
                        ...Object.values(alternatives).flat()
                    ];
                    allCards.forEach(card => {
                        if (parsed.oneLiners?.[card.id]) {
                            card.reasoning = parsed.oneLiners[card.id];
                        }
                    });
                    narration = Object.values(stageIntros).join('\n');
                }
            }
        } catch (e) {
            console.error("AI Narration Failed", e);
        }

        return {
            "@context": "https://schema.org",
            "@type": "ItemList",
            narration,
            target_date: startDate.toISOString().split('T')[0], // 날짜 정보 추가
            stageIntros: Object.keys(stageIntros).length > 0 ? stageIntros : undefined,
            stage1_timeline: stageIntros['stage1_timeline'],
            itemListElement: activeFacts,
            routeListElement: routeFacts,
            returnListElement: returnFacts.length > 0 ? returnFacts : undefined,
            featuredFestival: featuredFestival.length > 0 ? featuredFestival : undefined,
            alternatives
        };

    } catch (err) {
        console.error("Smart Plan generation failed:", err);
        return {
            "@context": "https://schema.org",
            "@type": "ItemList",
            narration: "여정 정보를 불러오는데 문제가 발생했습니다.",
            itemListElement: [],
            alternatives: {}
        };
    }
}
