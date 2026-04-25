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
    "@context": "https://schema.org",
    "@type": "ItemList",
    narration: string;
    itemListElement: FactCard[]; // Track A: Destination Core Facts (Day 2, 3)
    routeListElement?: FactCard[]; // Track B: Journey (Route/Midpoint) Facts (Day 1)
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

function calcContextFitDeep(f: FactCard, weather: string, isWinter: boolean, persona: UserPersona): number {
    let score = 25; // Base contextFit
    const name = f.name || '';
    const desc = f.description || '';
    const text = name + ' ' + desc;

    const adults = persona.guestDetails?.adults || 2;
    const seniors = persona.guestDetails?.seniors || 0;
    const preschool = persona.guestDetails?.kids?.preschool || 0;
    const elementary = persona.guestDetails?.kids?.elementary || 0;
    const hasKids = preschool > 0 || elementary > 0;
    const hasPet = persona.guestDetails?.hasPet || false;
    const isCouple = adults === 2 && seniors === 0 && !hasKids;

    // 1. Weather Deep Score
    if (weather.includes('비') || weather.includes('눈')) {
        if (text.match(/탕|찌개|칼국수|국밥|전골/)) score += 20;
        if (text.match(/박물관|실내|미술관/)) score += 20;
        if (f.category === 'SPOT' && !text.match(/박물관|실내|미술관/)) score -= 20;
    }
    if (weather.includes('맑음')) {
        if (text.match(/막국수|냉면|구이/)) score += 15;
        if (text.match(/수목원|둘레길|계곡|야외|산책/)) score += 15;
    }
    if (isWinter && f.category === 'GAS_STATION') score += 20;

    // 2. Persona Deep Score
    // 👶 아이 동반 (Kids)
    if (hasKids) {
        if (f.category === 'HOSPITAL' && text.match(/소아과|아동병원/)) score += 50;
        if (text.match(/돈까스|피자|어린이|불고기|뷔페|놀이방/)) score += 30;
        if (f.category === 'SPOT' && text.match(/동물|목장|아쿠아리움|체험|공룡|생태|과학관/)) score += 30;
        if (text.match(/매운|곱창|술집|노키즈존|이자카야/)) score -= 30;
    }

    // 🐶 반려견 동반 (Pets)
    if (hasPet) {
        if (text.match(/애견동반|야외테라스|반려견|산책|운동장|해변|반려/)) score += 30;
        if (text.match(/국립공원|휴양림|실내|박물관|미술관/)) score -= 40; // 출입금지 확률 높음
    }

    // 👵 부모님 동반 (Seniors)
    if (seniors > 0) {
        if (text.match(/한정식|백숙|보양식|장어|한우|전통|향토/)) score += 30;
        if (f.category === 'SPOT' && text.match(/온천|사찰|절|유적지|재래시장|경관|시장/)) score += 30;
        if (text.match(/계단|등산|액티비티|패스트푸드|웨이팅/)) score -= 20;
    }

    // 👩‍❤️‍👨 커플/감성 (Couples)
    if (isCouple) {
        if (text.match(/파스타|오션뷰|브런치|베이커리|와인|감성|루프탑/)) score += 25;
        if (f.category === 'SPOT' && text.match(/야경|포토존|스냅|벽화|전시관/)) score += 25;
    }

    // 🍲 미식가 / 태그 기반
    const tags = persona.topTags || [];
    const isFoodie = tags.some(t => t.tagId.includes('FOOD') && t.weight > 5);
    if (isFoodie || seniors > 0) {
        if (text.match(/백년가게|명인|원조|노포|시장/)) score += 30;
    }

    return Math.max(0, Math.min(100, score)); // 0 ~ 100 
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

    let source = raw.api_source || raw.sourceName || '';

    // [v11.9.23] 개별 인증 보장 및 중복 표기 로직
    if (source === 'SMBA_BAEK' || raw.badges?.includes('백년가게')) {
        certs.push('중기부 백년가게'); badges.push('백년가게'); emojis.push('🎖️백년가게');
    }
    if (source === 'LX_RESTAURANT') {
        certs.push('LX한국국토정보공사 인증'); badges.push('LX인증'); emojis.push('🎖️LX인증');
    }
    if (source === 'MOIS_GOOD_RESTAURANT' || source === 'LOCALDATA_RESTAURANT_GOOD' || raw.badges?.includes('모범음식점')) {
        certs.push('행안부 모범음식점'); badges.push('모범음식점'); emojis.push('🎖️모범음식점');
    }
    if (source === 'SAFE_RESTAURANT' || raw.badges?.includes('안심식당')) {
        certs.push('농식품부 안심식당'); badges.push('안심식당'); emojis.push('🎖️안심식당');
    }
    const isHospital = category === 'HOSPITAL' || category === 'ROUTE_HOSPITAL';
    if (isHospital && (source === 'NMC_HOSPITAL' || raw.name?.includes('의료원') || raw.name?.match(/종합병원|응급/))) {
        certs.push('응급의료기관'); badges.push('응급의료기관'); emojis.push('🚨응급의료기관');
    }
    const isSpot = category === 'SPOT' || category === 'ROUTE_SPOT';
    if (isSpot) {
        // [v11.9.23] 티어 점수가 70점 이상이면 무조건 지역명소 마크 부여
        const ts = raw.trust_score || 0;
        const fullText = (raw.name || '') + ' ' + (raw.description || '') + ' ' + (raw.raw_data?.description || '');
        const match8 = fullText.match(/([가-힣]+)\s*(8경|구경|팔경)/);
        
        if (match8) {
            emojis.push(`👑${match8[1]} ${match8[2]}!`);
        } else if (ts >= 70) {
            emojis.push('👑지역명소');
        }
    }

    return {
        stars: stars > 0 ? stars : undefined,
        reviews: raw.kakao_reviews || raw.scraping?.reviewCount || undefined,
        certifications: certs,
        badges,
        emojiString: emojis.length > 0 ? emojis.join(' ') : undefined
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
        metadata: row.raw_data || {},
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

    const facts = data.map(row => {
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

    // 5km 내의 마스터 장소 호출 (카카오 API 안 씀)
    const searchRadii = [5000, 10000, 15000, 20000, 25000, 30000];
    const categories = ['RESTAURANT', 'SPOT'];
    let allData: any[] = [];

    for (const radius of searchRadii) {
        let foundAnyInCategory = false;

        for (const cat of categories) {
            const { data: rpcData, error } = await supabase.rpc('get_master_places_in_radius_v2', {
                target_lat: midpoint.lat,
                target_lng: midpoint.lng,
                radius_meters: radius,
                limit_count: 30,
                p_category: cat
            });

            if (error) {
                console.error(`[Track B] RPC Error for ${cat} at ${radius}m:`, error.message);
                continue;
            }

            if (rpcData && rpcData.length > 0) {
                allData.push(...rpcData);
                foundAnyInCategory = true;
            }
        }

        if (foundAnyInCategory) {
            console.log(`[Track B] Found ${allData.length} total candidates at ${radius}m radius.`);
            break;
        }
    }

    if (allData.length === 0) {
        console.warn(`[Track B] No candidates found even at 30km radius.`);
        return [];
    }

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
        
        // [v11.9.23] 강력 블랙리스트 (식당이 아닌 것들 제거)
        const globalBlacklist = /정비|카센터|공업사|세차|타이어|배터리|공인중개사|부동산|장례|상조|종교|교회|사찰$|센터$|학원|관리소|사무소/;
        if (globalBlacklist.test(name)) return;

        if (!['RESTAURANT', 'SPOT'].includes(row.category) && !name.includes('카페')) return;
        
        let cat: FactCard['category'] = 'ROUTE_SPOT';
        if (row.category === 'RESTAURANT') cat = 'ROUTE_RESTAURANT';
        if (name.includes('카페') || row.category === 'CAFE') cat = 'ROUTE_CAFE';

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

async function getMidpointOnRoad(origin: { lat: number, lng: number }, dest: { lat: number, lng: number }): Promise<{ lat: number, lng: number } | null> {
    const apiKey = process.env.KAKAO_REST_API_KEY;
    if (!apiKey) return null;

    try {
        const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${origin.lng},${origin.lat}&destination=${dest.lng},${dest.lat}&priority=RECOMMEND`;
        const res = await fetch(url, { headers: { 'Authorization': `KakaoAK ${apiKey}` } });
        const data = await res.json();
        // console.log("Kakao API Response:", JSON.stringify(data).slice(0, 100));

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
    origin?: { lat: number; lng: number }
): Promise<StandardizedPlanJSON> {
    try {
        const persona = await extractUserPersona(userId);
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Find Reservation ID for Track A
        let reservationId: string | null = null;
        if (userId) {
            // 시간대 문제 방지를 위한 안전한 날짜 포맷 (한국 시간 기준)
            const kstDate = new Date(startDate.getTime() + (9 * 60 * 60 * 1000));
            const formattedDate = kstDate.toISOString().split('T')[0];
            console.log(`[SmartPlan] Querying user_schedules for User: ${userId}, Date: ${formattedDate}`);
            
            const { data: resData } = await supabase
                .from('user_schedules')
                .select('id')
                .eq('user_id', userId)
                .eq('check_in', formattedDate)
                .order('created_at', { ascending: false })
                .limit(1);
            if (resData && resData.length > 0) reservationId = resData[0].id;
        }

        // 2. Weather
        let weatherSummary = "맑음";
        let isWinter = false;
        try {
            const w = await getForecast(location.lat, location.lng, startDate.toISOString().split('T')[0]);
            if (w) {
                weatherSummary = `${w.sky}(${w.temp_min}~${w.temp_max}도)`;
                if (w.temp_min <= 5) isWinter = true;
            }
        } catch(e) {}

        // 3. Track B (Midpoint / Day 1)
        const routeFacts: FactCard[] = [];
        const alternatives: Record<string, FactCard[]> = {};

        if (origin) {
            const midpoint = await getMidpointOnRoad(origin, location);
            console.log(`[Track B] Calculated Midpoint:`, midpoint);
            if (midpoint) {
                const trackBFacts = await fetchMidpointTrackB(midpoint, weatherSummary, isWinter, persona);
                ['ROUTE_RESTAURANT', 'ROUTE_CAFE', 'ROUTE_SPOT'].forEach(cat => {
                    const catFacts = trackBFacts.filter(f => f.category === cat).sort((a, b) => b.trustScore - a.trustScore);
                    if (catFacts.length > 0) {
                        catFacts[0].selectionTier = 'PRIMARY';
                        routeFacts.push(catFacts[0]);
                        // Paging UI를 위해 15개 꽉꽉 채워 넣음
                        alternatives[cat] = catFacts.slice(1, 15).map(f => { f.selectionTier = 'ALTERNATIVE'; return f; });
                    }
                });
            }
        }

        // 4. Track A (Destination / Day 2, 3)
        const activeFacts: FactCard[] = [];
        let featuredFestival: FactCard[] = [];
        
        if (reservationId) {
            const trackAFacts = await fetchCachedTrackA(reservationId, weatherSummary, isWinter, persona);
            
            ['HOSPITAL', 'MART', 'RESTAURANT', 'GAS_STATION', 'SPOT'].forEach(cat => {
                const catFacts = trackAFacts.filter(f => f.category === cat).sort((a, b) => b.trustScore - a.trustScore);
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
            // 실제 서비스에서는 에러처리하거나 실시간으로 대체 조회해야 하지만, D-3 컨셉이므로 일단 빈 배열
            console.warn("No reservation ID found. Track A is empty.");
        }

        // 5. AI Narration with 5-Part Timeline Prompt
        let narration = "데이터를 분석하여 완벽한 여정을 짰습니다. 리스트를 스와이프하여 확인해 보세요!";
        try {
            const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
            if (geminiKey) {
                const formatAI = (f: FactCard): string => {
                    const emj = f.evidence?.emojiString ? ` ${f.evidence.emojiString}` : '';
                    return `- [${f.category}] ||${f.id}|${f.name}||: ${f.description}${emj}`;
                };

                const routeContext = routeFacts.length > 0 ? routeFacts.map(formatAI).join('\n') : '중간 경로 추천이 없습니다.';
                const destContext = activeFacts.map(formatAI).join('\n');
                const festContext = featuredFestival.map(formatAI).join('\n');

                const prompt = `
당신은 '라온아이'의 수석 캠핑 플래너입니다.
[날씨]: ${weatherSummary} / [페르소나]: ${persona.description}

아래 5단계 서사 구조로 가장 감성적이고 따뜻한 여정 가이드를 작성해주세요.
[1. 가는 길] 중간 지점의 식당/카페/간단 명소를 소개합니다.
${routeContext}

[2. 장보기]
${activeFacts.filter(f=>f.category==='MART').map(formatAI).join('\n')}

[3. 도착 식사]
${activeFacts.filter(f=>f.category==='RESTAURANT').map(formatAI).join('\n')}

[4. 현지 힐링] 주변 명소와 축제
${activeFacts.filter(f=>f.category==='SPOT').map(formatAI).join('\n')}
${festContext}

[5. 귀갓길]
(여정의 마무리를 따뜻하게 장식할 인사를 남겨주세요. 남은 명소 중 하나를 가볍게 들르라고 제안해도 좋습니다.)

[필수 규칙]
1. 장소 이름은 무조건 ||ID|이름|| 규격 사용
2. 프롬프트에 제공된 인증마크 이모지(예: 🎖️백년가게)가 있다면 산출물에 그대로 복사해서 노출하세요.
3. 각 장소가 위 페르소나와 왜 잘 맞는지 핵심 이유 1줄을 작성하세요. JSON 출력.

{
  "narration": "5단계 감성 서사...",
  "reasons": {
    "ID1": "추천 이유 1"
  }
}
                `.trim();

                const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { response_mime_type: "application/json" }
                    })
                });

                const apiData = await apiRes.json();
                const responseText = apiData.candidates?.[0]?.content?.parts?.[0]?.text;
                if (responseText) {
                    const parsed = JSON.parse(responseText.replace(/\`\`\`json/g,'').replace(/\`\`\`/g,''));
                    narration = parsed.narration;
                    [...routeFacts, ...activeFacts, ...featuredFestival].forEach(card => {
                        if (parsed.reasons && parsed.reasons[card.id]) card.reasoning = parsed.reasons[card.id];
                    });
                }
            }
        } catch (e) {
            console.error("AI Narration Failed", e);
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
