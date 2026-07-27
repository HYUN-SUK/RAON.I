// ========================================================================================
// Smart Camping Plan Phase 2: Live Engine with Deep Scoring & Track B Deep Filtering
// ========================================================================================
import { UserPersona, extractUserPersona } from './persona';
import { getForecast } from '@/lib/weather';
import { createClient } from '@supabase/supabase-js';
import {
  springGreetings,
  summerGreetings,
  autumnGreetings,
  winterGreetings,
  soloCouplePhrases,
  kidsPhrases,
  petPhrases,
  seniorPhrases,
  weatherNarratives,
  flowComments,
  tagStatusPhrases,
  futureWeatherPhrases
} from '../constants/smartPlanPhrases';

// ========================================================================================
// ========================================================================================
// Helper: detectWeatherFlow (시간 흐름에 따른 날씨 변화 감지)
// ========================================================================================
export function detectWeatherFlow(
    timeline: any[], 
    startStr: string, 
    endStr: string
): 'RAIN_TO_CLEAR' | 'CLEAR_TO_RAIN' | 'CLOUDY_TO_CLEAR' | 'CLEAR_TO_CLOUDY' | 'MIXED' | 'STEADY' {
    const targetTimeline = timeline
        .filter(t => {
            const cleanTDate = t.date.replace(/-/g, '');
            return cleanTDate >= startStr && cleanTDate <= endStr;
        })
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

    if (targetTimeline.length < 2) return 'STEADY';

    const midIndex = Math.floor(targetTimeline.length / 2);
    const firstHalf = targetTimeline.slice(0, midIndex);
    const secondHalf = targetTimeline.slice(midIndex);

    const checkRain = (items: any[]) => items.some(t => {
        const pty = typeof t.pty === 'string' ? parseInt(t.pty) : (t.pty || 0);
        return [1, 2, 4].includes(pty);
    });

    const checkCloudy = (items: any[]) => {
        const cloudyCount = items.filter(t => {
            const sky = typeof t.sky === 'string' ? parseInt(t.sky) : (t.sky || 1);
            return [3, 4].includes(sky);
        }).length;
        return (cloudyCount / items.length) >= 0.5;
    };

    const firstRain = checkRain(firstHalf);
    const secondRain = checkRain(secondHalf);
    const firstCloudy = checkCloudy(firstHalf);
    const secondCloudy = checkCloudy(secondHalf);

    if (firstRain && !secondRain) return 'RAIN_TO_CLEAR';
    if (!firstRain && secondRain) return 'CLEAR_TO_RAIN';
    if (firstCloudy && !secondCloudy && !secondRain) return 'CLOUDY_TO_CLEAR';
    if (!firstCloudy && secondCloudy && !firstRain && !secondRain) return 'CLEAR_TO_CLOUDY';
    if ((firstRain && secondRain) || (firstCloudy && secondCloudy)) return 'MIXED';

    return 'STEADY';
}

// Interfaces
// ========================================================================================
export interface DailyForecastItem {
    date: string;        // "08/15"
    dayOfWeek?: string;  // "금"
    sky: string;         // "맑음" | "구름많음" | "흐림" | "비" | "눈"
    skyIcon: string;     // "☀️" | "⛅" | "☁️" | "🌧️" | "❄️"
    minTemp: number;
    maxTemp: number;
    pop: number;         // 강수확률
}

export interface HourlyDetailItem {
    date: string;        // "08/15"
    hour: string;        // "06시"
    sky: string;         // "맑음"
    temp: number;
    windDir?: string;    // "남서풍"
    windSpeed?: number;  // 2.1
}

export interface WeatherBriefing {
    status: 'UNAVAILABLE' | 'DAILY' | 'DETAILED';
    dDay: number;
    dailyForecasts: DailyForecastItem[];
    hourlyDetails?: HourlyDetailItem[];
    avgWindSpeed?: number | null;
    maxWindSpeed?: number | null;
    windDirection?: string;
    avgHumidity?: number | null;
    flowAlert?: string;
}

export interface StandardizedPlanJSON {
    "@context": "https://schema.org";
    "@type": "ItemList";
    narration: string;
    stageIntros?: Record<string, string>;  // [v11.9.25] 5단계 모듈형 연결 문구
    stage1_timeline?: string; // [v11.9.32] Stage 1 타임라인 감성 멘트
    target_date?: string;
    weatherBriefing?: WeatherBriefing;     // [v12.6.0] 날씨 브리핑 카드 데이터
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
// PRO Timeline Interfaces (Smart Plan LIVE)
// ========================================================================================

/** PRO 타임라인의 개별 시간 블록 */
export interface TimelineBlock {
    id: string;                  // 고유 ID
    day: number;                 // 1, 2, 3 (몇째날)
    time: string;                // "09:00" 시작 시각
    endTime: string;             // "10:00" 종료 시각
    type: 'move' | 'meal' | 'activity' | 'cafe' | 'rest' | 'setup' | 'free';
    title: string;               // "세종 전망대 산책"
    duration_mins: number;       // 체류 시간 (분)
    travel_mins: number;         // 이전 블록으로부터 이동 시간 (분)
    location_id?: string;        // FactCard.id 참조
    factCard?: FactCard;         // 매핑된 장소 카드 (UI 렌더링용)
    phone?: string;              // 전화번호 (Phase 2 리밸런싱용)
    description?: string;        // AI 한줄 소개
    slotType?: string;           // 슬롯 식별 (e.g. 'morning_spot', 'lunch')
    status?: 'upcoming' | 'active' | 'completed' | 'skipped';
    hidden?: boolean;            // 숨김 여부
}

/** PRO 타임라인 Day 단위 묶음 */
export interface TimelineDay {
    day: number;
    date: string;                // "2026-05-20"
    label: string;               // "첫째 날 — 설레는 출발"
    blocks: TimelineBlock[];
}

/** PRO 타임라인 전체 응답 구조 */
export interface ProTimelinePlan {
    mode: 'PRO';
    travelType: 'camping' | 'general';
    narration: string;
    days: TimelineDay[];
    /** 캠핑 모드 체류 구간용 장소 카드 리스트 */
    campingCards?: {
        mart: FactCard[];
        spot: FactCard[];
        restaurant: FactCard[];
        gas: FactCard[];
    };
    factCards: FactCard[];
    alternatives: Record<string, FactCard[]>;
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

    if (isHospital) {
        const hvec = raw.raw_data?.hvec !== undefined ? raw.raw_data.hvec : raw.hvec;
        const hvs01 = raw.raw_data?.hvs01 !== undefined ? raw.raw_data.hvs01 : raw.hvs01;
        const hvct = raw.raw_data?.hvctayn !== undefined ? raw.raw_data.hvctayn : raw.hvctayn;
        const hvmri = raw.raw_data?.hvmriayn !== undefined ? raw.raw_data.hvmriayn : raw.hvmriayn;
        
        if (hvec !== undefined && hvec !== null && hvec !== '') {
            const hvecNum = parseInt(hvec);
            if (!isNaN(hvecNum) && hvecNum > 0) {
                certs.push(`일반병상 ${hvecNum}석 여유`);
                badges.push(`일반병상_${hvecNum}`);
                emojis.push(`🟢일반 ${hvecNum}석`);
            }
        }
        if (hvs01 !== undefined && hvs01 !== null && hvs01 !== '') {
            const hvsNum = parseInt(hvs01);
            if (!isNaN(hvsNum) && hvsNum > 0) {
                certs.push(`소아병상 ${hvsNum}석 여유`);
                badges.push(`소아병상_${hvsNum}`);
                emojis.push(`👶소아 ${hvsNum}석`);
            }
        }
        if (hvct === 'Y') {
            certs.push('CT 가동');
            badges.push('CT가동');
            emojis.push('⚡CT가동');
        }
        if (hvmri === 'Y') {
            certs.push('MRI 가동');
            badges.push('MRI가동');
            emojis.push('⚡MRI가동');
        }
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
            address: row.address || row.raw_data?.address,
            hvec: row.raw_data?.hvec !== undefined ? row.raw_data.hvec : row.hvec,
            hvs01: row.raw_data?.hvs01 !== undefined ? row.raw_data.hvs01 : row.hvs01,
            hvctayn: row.raw_data?.hvctayn !== undefined ? row.raw_data.hvctayn : row.hvctayn,
            hvmriayn: row.raw_data?.hvmriayn !== undefined ? row.raw_data.hvmriayn : row.hvmriayn,
            dutyTel3: row.raw_data?.dutyTel3 !== undefined ? row.raw_data.dutyTel3 : row.dutyTel3,
            // [v11.9.56] 주유소 등유 가격 명시적 매핑
            kerosenePrice: cat === 'GAS_STATION' ? (row.raw_data?.PRICE || row.raw_data?.K_PRICE || row.description?.match(/등유:\s?(\d+)원/)?.[1]) : undefined
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

    // [v12.1.0] master_places 테이블의 description 및 api_source 실시간 결합 ( candidates 스키마 누수 방지 )
    try {
        const factIds = data.map(row => row.fact_id).filter(Boolean);
        if (factIds.length > 0) {
            const { data: originalPlaces, error: joinErr } = await supabase
                .from('master_places')
                .select('id, description, raw_data')
                .in('id', factIds);
            
            if (!joinErr && originalPlaces) {
                const descMap = new Map(originalPlaces.map(p => [p.id, p]));
                data.forEach(row => {
                    const orig = descMap.get(row.fact_id);
                    if (orig) {
                        if (!row.raw_data) row.raw_data = {};
                        // description 컬럼 값을 raw_data.description 에 주입하여 parseFactCard 가 읽어가도록 함
                        row.raw_data.description = orig.description || '';
                        
                        // api_source 도 raw_data.description_api_source 에 주입
                        if (orig.raw_data && orig.raw_data.description_api_source) {
                            row.raw_data.description_api_source = orig.raw_data.description_api_source;
                        } else if (orig.description && (orig.description.includes('백년가게') || orig.description.includes('지정'))) {
                            row.raw_data.description_api_source = 'LOCAL_SPECIAL';
                        } else if (orig.description && (orig.description.includes('식당/카페입니다') || orig.description.includes('유선 확인'))) {
                            row.raw_data.description_api_source = 'LOCAL_FALLBACK';
                        }
                    }
                });
            }
        }
    } catch (joinEx) {
        console.error("[smartPlan] Realtime description join failed:", joinEx);
    }

    const globalBlacklist = /정비|카센터|공업사|세차|타이어|배터리|공인중개사|부동산|장례|상조|종교|교회|사찰$|센터$|학원|관리소|사무소|지물포|건재|상사|유통|공구|이발|미용|세탁|철물|사진관|인쇄소|스튜디오|모텔|여관|호텔|약국|의원|병원|디지털|분재|연구소|양복|안경|서점|서적/;

    const facts = data.filter(row => {
        const name = row.name || '';
        const cat = row.category;
        // [v11.9.56] 병원 카테고리는 병원/의원 키워드 필터링에서 제외 (데이터 유실 방지)
        if (cat !== 'HOSPITAL' && globalBlacklist.test(name)) return false;
        if (cat === 'HOSPITAL' && /구두/.test(name)) return false;
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
        const globalBlacklist = /정비|카센터|공업사|세차|타이어|배터리|공인중개사|부동산|장례|상조|종교|교회|사찰$|센터$|학원|관리소|사무소|지물포|건재|상사|유통|공구|이발|미용|세탁|철물|사진관|인쇄소|스튜디오|모텔|여관|호텔|약국|의원|병원|디지털|농약|종묘|정육|방앗간|기름집|분재|연구소|양복|안경|서점|서적/;
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
            
            const isBlacklisted = spotBlacklist.test(f.name.toLowerCase()) || spotBlacklist.test(nameDesc);
            if (isBlacklisted) simpleSpotBonus -= 100; // 사실상 제거
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
        
        if (sources.includes('SMBA_BAEK') || badges.includes('백년가게')) certBonus += 80;
        if (sources.includes('LX_RESTAURANT')) certBonus += 80;
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
    predefinedMidpoint?: { lat: number; lng: number },
    mode?: 'BASIC' | 'PRO',
    travelType?: 'camping' | 'general',
    routeData?: any
): Promise<StandardizedPlanJSON | ProTimelinePlan> {
    try {
        // [v11.9.60] 정석적인 서버 사이드 인증 연동 (쿠키 기반)
        let supabase;
        try {
            const { createClient: createServerSupabase } = await import('@/lib/supabase-server');
            supabase = await createServerSupabase();
        } catch (cookieErr) {
            // [v11.9.62] CLI 테스트 등 cookies() 사용 불가 환경을 위한 fallback
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
            const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
            supabase = createClient(supabaseUrl, supabaseKey);
        }

        const persona = await extractUserPersona(userId, 7, supabase); // 인증된 클라이언트 전달

        // 1. Find Reservation ID for Track A (Location-Aware Matching)
        let reservationId: string | null = null;
        if (userId) {
            // [KST Timezone 보정] UTC 변환으로 인한 1일 왜곡 방지 (+9시간 적용)
            const kstStartDate = new Date(startDate.getTime() + (9 * 60 * 60 * 1000));
            const formattedDate = kstStartDate.toISOString().split('T')[0];

            // [v11.9.61] 1차: user_schedules에서 조회 (공간 매칭 도입)
            const { data: resData } = await supabase
                .from('user_schedules')
                .select('id, campground_lat, campground_lng')
                .eq('user_id', userId)
                .eq('check_in', formattedDate);

            if (resData && resData.length > 0) {
                if (resData.length === 1) {
                    reservationId = resData[0].id;
                } else {
                    // 복수 예약 시 거리 매칭 (Haversine 사용 안 함 - 단순 피타고라스로 충분)
                    let minOffset = Infinity;
                    resData.forEach(r => {
                        const rLat = parseFloat(r.campground_lat);
                        const rLng = parseFloat(r.campground_lng);
                        if (!isNaN(rLat) && !isNaN(rLng)) {
                            const offset = Math.sqrt(Math.pow(rLat - location.lat, 2) + Math.pow(rLng - location.lng, 2));
                            if (offset < minOffset) {
                                minOffset = offset;
                                reservationId = r.id;
                            }
                        }
                    });
                    // 거리 매칭 실패 시 최신 순 폴백
                    if (!reservationId) reservationId = resData[0].id;
                }
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
            
            // 3차 Fallback: 날짜를 ±3일 범위로 확장 검색 (여전히 공간 매칭 고려)
            if (!reservationId) {
                const prevDate = new Date(startDate.getTime() - (3 * 86400000)).toISOString().split('T')[0];
                const nextDate = new Date(startDate.getTime() + (3 * 86400000)).toISOString().split('T')[0];
                const { data: expandData } = await supabase
                    .from('user_schedules')
                    .select('id, campground_lat, campground_lng')
                    .eq('user_id', userId)
                    .gte('check_in', prevDate)
                    .lte('check_in', nextDate);

                if (expandData && expandData.length > 0) {
                    let minOffset = Infinity;
                    expandData.forEach(r => {
                        const rLat = parseFloat(r.campground_lat);
                        const rLng = parseFloat(r.campground_lng);
                        if (!isNaN(rLat) && !isNaN(rLng)) {
                            const offset = Math.sqrt(Math.pow(rLat - location.lat, 2) + Math.pow(rLng - location.lng, 2));
                            if (offset < minOffset) {
                                minOffset = offset;
                                reservationId = r.id;
                            }
                        }
                    });
                    if (!reservationId) reservationId = expandData[0].id;
                }
            }
        }

        // 2. Weather (Bypass if startDate is 8+ days away to optimize performance)
        let weatherSummary = "날씨 정보를 확인하고 있습니다.";
        let isWinter = false;
        let isRainy = false; 
        let isWeatherAvailable = false; 
        let w: any = null; 

        // KST 기준 D-Day 계산 (보정 왜곡이 없는 UTC/로컬 순수 일 계산식)
        const nowKST = new Date();
        const todayDateOnly = new Date(nowKST.getFullYear(), nowKST.getMonth(), nowKST.getDate());
        const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const diffDays = Math.round((startDateOnly.getTime() - todayDateOnly.getTime()) / (24 * 60 * 60 * 1000));
        const shouldFetchWeather = diffDays <= 7; // 7일 이내일 때만 실시간 호출

        const weatherBriefing: WeatherBriefing = {
            status: shouldFetchWeather ? 'DAILY' : 'UNAVAILABLE',
            dDay: diffDays,
            dailyForecasts: [],
            avgWindSpeed: 0,
            maxWindSpeed: 0,
            avgHumidity: 50
        };

        try {
            if (shouldFetchWeather) {
                w = await getForecast(location.lat, location.lng, startDate.toISOString().split('T')[0]);
                if (w && w.daily && Array.isArray(w.daily)) {
                    // [v11.9.60] 날짜 매칭 불일치 해결: 하이픈(-) 제거 후 비교
                    const startStr = startDate.toISOString().split('T')[0].replace(/-/g, '');
                    const endStr = endDate.toISOString().split('T')[0].replace(/-/g, '');
                    
                    const weatherList: string[] = [];
                    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

                    for (const dayForecast of w.daily) {
                        const cleanDate = dayForecast.date.replace(/-/g, '');
                        if (cleanDate >= startStr && cleanDate <= endStr) {
                            const shortDate = dayForecast.date.length === 8 
                                ? `${dayForecast.date.substring(4, 6)}/${dayForecast.date.substring(6, 8)}`
                                : dayForecast.date.substring(5).replace('-', '/');
                            
                            const isPrecipitation = (dayForecast.pop || 0) >= 50 || ['rainy', 'snowy'].includes(dayForecast.weatherCode);
                            const skyText = isPrecipitation 
                                ? (dayForecast.weatherCode === 'snowy' ? '눈' : '비') 
                                : (dayForecast.weatherCode === 'cloudy' ? '구름많음' : '맑음');
                            const skyIcon = isPrecipitation 
                                ? (dayForecast.weatherCode === 'snowy' ? '❄️' : '🌧️') 
                                : (dayForecast.weatherCode === 'cloudy' ? '⛅' : '☀️');
                            
                            let dayOfWeek: string | undefined = undefined;
                            try {
                                const rawDateStr = dayForecast.date.length === 8
                                    ? `${dayForecast.date.substring(0,4)}-${dayForecast.date.substring(4,6)}-${dayForecast.date.substring(6,8)}`
                                    : dayForecast.date;
                                const parsedD = new Date(rawDateStr);
                                if (!isNaN(parsedD.getTime())) dayOfWeek = dayNames[parsedD.getDay()];
                            } catch (_) {}

                            weatherBriefing.dailyForecasts.push({
                                date: shortDate,
                                dayOfWeek,
                                sky: skyText,
                                skyIcon,
                                minTemp: dayForecast.min || 0,
                                maxTemp: dayForecast.max || 0,
                                pop: dayForecast.pop || 0
                            });

                            weatherList.push(`${shortDate}(${skyText}, ${dayForecast.min || '-'}~${dayForecast.max || '-'}도)`);
                            
                            if (dayForecast.min && dayForecast.min <= 5) isWinter = true;
                            if (isPrecipitation) isRainy = true;
                        }
                    }
                    if (weatherList.length > 0) {
                        weatherSummary = weatherList.join(', ');
                        isWeatherAvailable = true; 
                    }

                    // D-3 이내 단기 구간일 때 3시간 단위 상세 정보 추가
                    if (diffDays <= 3 && w.timeline && Array.isArray(w.timeline)) {
                        weatherBriefing.status = 'DETAILED';
                        weatherBriefing.hourlyDetails = [];

                        const getWindDirectionText = (deg: number | undefined): string => {
                            if (deg === undefined) return '';
                            const index = Math.floor(((deg + 22.5) % 360) / 45);
                            const directions = ['북풍', '북동풍', '동풍', '남동풍', '남풍', '남서풍', '서풍', '북서풍'];
                            return directions[index];
                        };

                        const getWeatherStateText = (pty: number, sky: number): string => {
                            if (pty === 1) return '비';
                            if (pty === 2) return '비/눈';
                            if (pty === 3) return '눈';
                            if (pty === 4) return '소나기';
                            if (sky === 1) return '맑음';
                            if (sky === 3) return '구름많음';
                            if (sky === 4) return '흐림';
                            return '맑음';
                        };

                        for (const t of w.timeline) {
                            const cleanTDate = t.date.replace(/-/g, '');
                            if (cleanTDate >= startStr && cleanTDate <= endStr) {
                                const dateLabel = t.date.length === 8 
                                    ? `${t.date.substring(4, 6)}/${t.date.substring(6, 8)}`
                                    : t.date.substring(5).replace('-', '/');
                                
                                const hourStr = t.time.substring(0, 2) + '시';
                                const skyVal = typeof t.sky === 'string' ? parseInt(t.sky) : t.sky;
                                const ptyVal = typeof t.pty === 'string' ? parseInt(t.pty) : t.pty;
                                const stateText = getWeatherStateText(ptyVal || 0, skyVal || 1);
                                const windDir = getWindDirectionText(t.vec);

                                weatherBriefing.hourlyDetails.push({
                                    date: dateLabel,
                                    hour: hourStr,
                                    sky: stateText,
                                    temp: t.temp,
                                    windDir,
                                    windSpeed: t.wsd
                                });
                            }
                        }
                    }
                }
            } else {
                weatherSummary = "출발일이 아직 넉넉히 남아 날씨 정보는 대기 중입니다.";
            }
        } catch(e) {
            console.error("[SmartPlan] Weather Fetch Failed:", e);
        }

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
            console.warn("No reservation ID found. Track A is empty. Executing realtime fallback for essentials...");
            // 예약 매칭에 실패한 경우, 캠핑장 위치(location) 반경 20km 이내의 마트, 병원, 주유소, 식당, 명소를 실시간 룩업하여 적재
            try {
                const fallbackEssentials = await fetchMidpointTrackB(location, weatherSummary, isWinter, persona);
                ['HOSPITAL', 'MART', 'GAS_STATION', 'RESTAURANT', 'SPOT'].forEach(cat => {
                    let catFacts = fallbackEssentials.filter(f => f.category === cat);
                    catFacts.sort((a, b) => b.trustScore - a.trustScore);
                    if (catFacts.length > 0) {
                        catFacts[0].selectionTier = 'PRIMARY';
                        activeFacts.push(catFacts[0]);
                        alternatives[cat] = catFacts.slice(1, 15).map(f => { f.selectionTier = 'ALTERNATIVE'; return f; });
                    }
                });
            } catch (fallbackErr) {
                console.error("[smartPlan] Failed to query realtime fallback for essentials:", fallbackErr);
            }
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

        // [v12.0.0] 실시간 제미나이 호출부 차단 (주석 처리로 보존)
        /*
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

                const prompt = `...`;
                const apiRes = await fetch(...);
                // ...
            }
        } catch (e) {
            console.error('[smartPlan] Exception in Gemini API narration generation:', e);
        }
        */

        // [v12.0.0] 로컬 룰 기반 감성 서사 엔진 기동 (0원 무과금 & 초고속 렌더링)
        try {
            // A. 기상 정보(온도, 바람 세기 수치 및 기상 흐름) 추출
            let minTemp: number | null = null;
            let maxTemp: number | null = null;
            let avgWindSpeed = 1.5; // [v12.2.0] 평균 풍속
            let maxWindSpeed = 2.5; // [v12.2.0] 최고 풍속
            let totalWind = 0;
            let windCount = 0;
            let currentMaxWind = 0;
            let hasRain = false;
            let hasSnow = false;
            let hasShower = false;
            let totalHumidity = 0;
            let humidityCount = 0;
            let maxPop = 0;

            // [v12.1.0] KST 타임존 보정 헬퍼 (로컬 OS/시스템 타임존 기반으로 왜곡 없이 일치)
            const getKSTDateString = (d: Date) => {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };
            const startStr = getKSTDateString(startDate).replace(/-/g, '');
            const endStr = getKSTDateString(endDate).replace(/-/g, '');

            if (w && w.daily && Array.isArray(w.daily)) {
                for (const dayForecast of w.daily) {
                    const cleanDate = dayForecast.date.replace(/-/g, '');
                    if (cleanDate >= startStr && cleanDate <= endStr) {
                        if (dayForecast.min !== undefined && dayForecast.min !== null) {
                            const val = Number(dayForecast.min);
                            if (minTemp === null || val < minTemp) minTemp = val;
                        }
                        if (dayForecast.max !== undefined && dayForecast.max !== null) {
                            const val = Number(dayForecast.max);
                            if (maxTemp === null || val > maxTemp) maxTemp = val;
                        }
                        if (dayForecast.pop !== undefined && dayForecast.pop !== null) {
                            const val = Number(dayForecast.pop);
                            if (val > maxPop) maxPop = val;
                        }
                        if (dayForecast.humidity !== undefined && dayForecast.humidity !== null) {
                            totalHumidity += Number(dayForecast.humidity);
                            humidityCount++;
                        }
                        if (['rainy', 'shower'].includes(dayForecast.weatherCode) || (dayForecast.pop || 0) >= 50) {
                            hasRain = true;
                        }
                        if (dayForecast.weatherCode === 'snowy') {
                            hasSnow = true;
                        }
                    }
                }
            }

            if (w && w.timeline && Array.isArray(w.timeline)) {
                for (const t of w.timeline) {
                    const cleanTDate = t.date.replace(/-/g, '');
                    if (cleanTDate >= startStr && cleanTDate <= endStr) {
                        if (t.wsd !== undefined && t.wsd !== null) {
                            const wsdVal = Number(t.wsd);
                            totalWind += wsdVal;
                            windCount++;
                            if (wsdVal > currentMaxWind) {
                                currentMaxWind = wsdVal;
                            }
                        }
                        if (t.reh !== undefined && t.reh !== null) {
                            totalHumidity += Number(t.reh);
                            humidityCount++;
                        }
                        const ptyVal = typeof t.pty === 'string' ? parseInt(t.pty) : t.pty;
                        if (ptyVal === 1 || ptyVal === 2) hasRain = true;
                        if (ptyVal === 3) hasSnow = true;
                        if (ptyVal === 4) hasShower = true;
                    }
                }
            }

            if (windCount > 0) {
                avgWindSpeed = parseFloat((totalWind / windCount).toFixed(1));
                maxWindSpeed = parseFloat(currentMaxWind.toFixed(1));
            }

            // 습도 평균 연산
            const avgHumidity = humidityCount > 0 ? Math.round(totalHumidity / humidityCount) : 50;

            // B. 날씨 흐름 시나리오 결정 & 기온/습도/바람 4대 상태 판정
            let flowState: 'CLEAR_ONLY' | 'CLOUDY_ONLY' | 'RAIN_SNOW_ONLY' | 'CLEAR_TO_RAIN' | 'RAIN_TO_CLEAR' | 'COMPLEX_TRANSITION' = 'CLEAR_ONLY';
            if (hasSnow) {
                flowState = 'RAIN_SNOW_ONLY';
            } else if (hasRain || hasShower) {
                if (hasShower) {
                    flowState = 'COMPLEX_TRANSITION';
                } else {
                    flowState = 'CLEAR_TO_RAIN';
                }
            } else {
                let cloudyCount = 0;
                let totalCount = 0;
                if (w && w.timeline && Array.isArray(w.timeline)) {
                    for (const t of w.timeline) {
                        const cleanTDate = t.date.replace(/-/g, '');
                        if (cleanTDate >= startStr && cleanTDate <= endStr) {
                            const skyVal = typeof t.sky === 'string' ? parseInt(t.sky) : t.sky;
                            if (skyVal === 4 || skyVal === 3) {
                                cloudyCount++;
                            }
                            totalCount++;
                        }
                    }
                }
                if (totalCount > 0 && (cloudyCount / totalCount) >= 0.6) {
                    flowState = 'CLOUDY_ONLY';
                }
            }

            let tempState: 'COLD' | 'CHILLY' | 'MILD' | 'HOT' = 'MILD';
            if (minTemp !== null && minTemp <= 0) {
                tempState = 'COLD';
            } else if (minTemp !== null && minTemp > 0 && maxTemp !== null && maxTemp <= 15) {
                tempState = 'CHILLY';
            } else if (maxTemp !== null && maxTemp >= 28) {
                tempState = 'HOT';
            }

            let humidState: 'DRY' | 'NORMAL' | 'WET' = 'NORMAL';
            if (avgHumidity <= 35) {
                humidState = 'DRY';
            } else if (avgHumidity >= 75) {
                humidState = 'WET';
            }

            let windState: 'MILD' | 'MODERATE' | 'STRONG' = 'MILD';
            if (maxWindSpeed >= 8) {
                windState = 'STRONG';
            } else if (maxWindSpeed >= 4) {
                windState = 'MODERATE';
            }

            // C. 조립 블록 1: 계절/월별 인사말 선택 (날씨가 비/눈/흐림일 경우 맑은 감성 묘사 차단 필터 적용)
            const month = startDate.getMonth() + 1;
            let greeting = "";
            
            const isRainyOrSnowy = hasRain || hasSnow || hasShower;
            const filterGreetings = (pool: string[]): string[] => {
                if (!isRainyOrSnowy) return pool;
                const clearKeywords = ['햇살', '눈부신', '화창', '쨍한', '맑고', '맑은', '봄볕', '봄볕이', '햇빛'];
                const filtered = pool.filter(g => !clearKeywords.some(kw => g.includes(kw)));
                return filtered.length > 0 ? filtered : pool;
            };

            if (month >= 3 && month <= 5) {
                const pool = filterGreetings(springGreetings);
                greeting = pool[Math.floor(Math.random() * pool.length)].replace('${month}', String(month));
            } else if (month >= 6 && month <= 8) {
                const pool = filterGreetings(summerGreetings);
                greeting = pool[Math.floor(Math.random() * pool.length)].replace('${month}', String(month));
            } else if (month >= 9 && month <= 11) {
                const pool = filterGreetings(autumnGreetings);
                greeting = pool[Math.floor(Math.random() * pool.length)].replace('${month}', String(month));
            } else {
                const pool = filterGreetings(winterGreetings);
                greeting = pool[Math.floor(Math.random() * pool.length)].replace('${month}', String(month));
            }

            // D. 조립 블록 2: 동반객 인원 구성 묘사 선택
            const adults = persona.guestDetails?.adults || 2;
            const seniors = persona.guestDetails?.seniors || 0;
            const preschool = persona.guestDetails?.kids?.preschool || 0;
            const elementary = persona.guestDetails?.kids?.elementary || 0;
            const teen = persona.guestDetails?.kids?.teen || 0;
            const kidCount = preschool + elementary + teen;
            const hasPet = persona.guestDetails?.hasPet || false;

            let companionNarrative = "";
            
            // 다중 동반자 상황별 정교한 감성 융합 작문
            if (kidCount > 0 && hasPet && seniors > 0) {
                companionNarrative = `사랑하는 부모님과 ${kidCount}명의 아이들, 그리고 귀여운 반려견까지 온 가족이 다 함께 발걸음을 맞춰 안전하고 포근하게 머물 수 있는 시간입니다.`;
            } else if (kidCount > 0 && hasPet) {
                companionNarrative = `${kidCount}명의 아이들이 자연의 흙을 밟으며 맑게 웃고, 귀여운 반려견도 솔방울을 킁킁거리며 다 함께 보물 같은 동심을 만끽할 수 있는 다정한 시간입니다.`;
            } else if (kidCount > 0 && seniors > 0) {
                companionNarrative = `든든한 부모님을 정성스레 모시고 ${kidCount}명의 소중한 아이들과 도란도란 정겨운 옛이야기를 나누며 천천히 걷기 편안한 여정입니다.`;
            } else if (hasPet && seniors > 0) {
                companionNarrative = `사랑하는 부모님과 꼬리 치는 반려견을 품에 포근히 안아주며 무리 없이 편안히 거닐 수 있는 안심 숲길 코스입니다.`;
            } else {
                // 단독 동반자 매칭
                const companionParts: string[] = [];
                if (kidCount > 0) {
                    const kPhrase = kidsPhrases[Math.floor(Math.random() * kidsPhrases.length)].replace('${kids}', String(kidCount));
                    companionParts.push(kPhrase);
                } else if (hasPet) {
                    const pPhrase = petPhrases[Math.floor(Math.random() * petPhrases.length)];
                    companionParts.push(pPhrase);
                } else if (seniors > 0) {
                    const sPhrase = seniorPhrases[Math.floor(Math.random() * seniorPhrases.length)];
                    companionParts.push(sPhrase);
                } else {
                    const scPhrase = soloCouplePhrases[Math.floor(Math.random() * soloCouplePhrases.length)];
                    companionParts.push(scPhrase);
                }
                companionNarrative = companionParts.join(' ');
            }

            // E. 조립 블록 3: 기상 시나리오 및 추천형 한 줄 멘트 선택
            let weatherNarrative = "";

            if (diffDays <= 3) {
                weatherBriefing.avgWindSpeed = avgWindSpeed;
                weatherBriefing.maxWindSpeed = maxWindSpeed;
                weatherBriefing.avgHumidity = avgHumidity;
            } else {
                weatherBriefing.avgWindSpeed = null;
                weatherBriefing.maxWindSpeed = null;
                weatherBriefing.avgHumidity = null;
            }

            if (w && w.timeline && Array.isArray(w.timeline)) {
                const startStr = startDate.toISOString().split('T')[0].replace(/-/g, '');
                const endStr = endDate.toISOString().split('T')[0].replace(/-/g, '');
                const flowPattern = detectWeatherFlow(w.timeline, startStr, endStr);
                if (flowPattern !== 'STEADY' && flowComments[flowPattern]) {
                    const fPool = flowComments[flowPattern];
                    weatherBriefing.flowAlert = fPool[Math.floor(Math.random() * fPool.length)];
                }
            }

            if (!isWeatherAvailable || minTemp === null || maxTemp === null) {
                weatherNarrative = futureWeatherPhrases[Math.floor(Math.random() * futureWeatherPhrases.length)];
            } else {
                // 1) 하늘/강수 상태 결정
                let skyKey: 'CLEAR' | 'CLOUDY' | 'RAIN' | 'SNOW' = 'CLEAR';
                if (hasSnow || (minTemp <= 0 && hasRain)) {
                    skyKey = 'SNOW';
                } else if (hasRain || hasShower) {
                    skyKey = 'RAIN';
                } else if (flowState === 'CLOUDY_ONLY') {
                    skyKey = 'CLOUDY';
                }

                // 2) 상황 키 매핑 및 추천형 한 줄 멘트 선택 (50~70자)
                const situationKey = `${skyKey}_${tempState}`;
                const pool = (situationKey in weatherNarratives)
                    ? weatherNarratives[situationKey as keyof typeof weatherNarratives]
                    : weatherNarratives['CLEAR_MILD'];
                weatherNarrative = pool[Math.floor(Math.random() * pool.length)];
            }

            // G. 5단계 stageIntros 조립 (계절 인사말 => 동반자 구성 => 날씨 맞춤 추천 멘트)
            stageIntros['1'] = `${greeting} ${companionNarrative} ${weatherNarrative}`;
            
            stageIntros['2'] = "설레는 출발의 순간! 캠핑장으로 향하며 가볍게 들러갈 수 있는 아늑한 맛집과 쉼표 같은 카페를 지나가 볼까요?";
            stageIntros['3'] = "캠핑의 든든한 기본! 캠핑장에 입실하기 전 신선한 식재료를 채워줄 보급소와 따뜻한 겨울을 준비할 등유 주유소에 들르는 시간이에요.";
            stageIntros['4'] = "드디어 아늑한 라온아이에 안착했네요. 짐을 풀고 잠시 숨을 고른 뒤, 자연의 품에서 천천히 거닐 수 있는 현지의 보석 같은 명소들을 찾아 떠나요.";
            stageIntros['5'] = "아쉬운 이별을 뒤로하고 일상으로 돌아가는 길. 긴 여운을 달래줄 조용하고 예쁜 카페와 든든한 식사 한 끼로 여행을 포근하게 마감해 보아요.";

            // H. stage1_timeline 타임라인 출발 인사말 정의
            if (isWeatherAvailable && minTemp !== null && maxTemp !== null) {
                if (hasSnow) {
                    stageIntros['stage1_timeline'] = "하얀 눈송이가 낭만을 그리는 캠핑 날, 눈길 조심해서 포근한 설국으로 출발해요!";
                } else if (hasRain || hasShower) {
                    stageIntros['stage1_timeline'] = "토닥토닥 빗소리가 감성을 더하는 캠핑 날, 안전운전하여 낭만적인 하루를 시작해 봐요.";
                } else {
                    stageIntros['stage1_timeline'] = "드디어 오랫동안 기다렸던 캠핑 날! 안전하고 신나는 발걸음으로 출발해 볼까요?";
                }
            } else {
                stageIntros['stage1_timeline'] = "설레는 마음으로 기분 좋게 짐을 싸서, 라온아이 캠핑장으로 활기차게 출발해 보아요!";
            }

            // [v12.5.2] 런타임 공간 중복 제거 안전망 (Spatial Deduplication Safety Net) 고도화
            const deduplicateSpatial = (cards: FactCard[]): FactCard[] => {
                const result: FactCard[] = [];
                const getDist = (lat1: number, lng1: number, lat2: number, lng2: number) => {
                    const R = 6371e3;
                    const f1 = lat1 * Math.PI/180, f2 = lat2 * Math.PI/180;
                    const df = (lat2-lat1) * Math.PI/180, dl = (lng2-lng1) * Math.PI/180;
                    const a = Math.sin(df/2) * Math.sin(df/2) + Math.cos(f1) * Math.cos(f2) * Math.sin(dl/2) * Math.sin(dl/2);
                    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                };
                const clean = (s: string) => (s || '').replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').replace(/\s/g, '').toLowerCase();

                for (const card of cards) {
                    let isDup = false;
                    for (const existing of result) {
                        // [교차 카테고리 보호 안전망] 서로 다른 종류의 시설은 거리가 가깝더라도 중복 제거하지 않음
                        if (card.category !== existing.category) continue;

                        const dist = getDist(card.lat, card.lng, existing.lat, existing.lng);
                        const n1 = clean(card.name), n2 = clean(existing.name);
                        
                        // [v12.5.2] 물리적 거리가 50m 이내로 극히 근접하면 이름 차이와 무관하게 100% 중복 처리 (달서별빛캠프캠핑장 중복 회피)
                        const isSpatialDup = dist < 50 || (dist < 500 && (n1.includes(n2) || n2.includes(n1)));
                        
                        if (isSpatialDup) {
                            isDup = true;
                            if (card.trustScore > existing.trustScore) {
                                Object.assign(existing, card);
                            }
                            break;
                        }
                    }
                    if (!isDup) {
                        result.push(card);
                    }
                }
                return result;
            };

            const cleanActive = deduplicateSpatial(activeFacts);
            const cleanRoute = deduplicateSpatial(routeFacts);
            const cleanReturn = deduplicateSpatial(returnFacts);
            const cleanFeatured = deduplicateSpatial(featuredFestival);

            // [v12.5.2] 교차 카테고리 간 명소(SPOT/ROUTE_SPOT 등) 중복 도려내기를 위해 alternatives 전체를 평탄화하여 글로벌 제거 가동
            const primaryGroup = [...cleanActive, ...cleanRoute, ...cleanReturn, ...cleanFeatured];
            const getDistHelper = (lat1: number, lng1: number, lat2: number, lng2: number) => {
                const R = 6371e3;
                const f1 = lat1 * Math.PI/180, f2 = lat2 * Math.PI/180;
                const df = (lat2-lat1) * Math.PI/180, dl = (lng2-lng1) * Math.PI/180;
                const a = Math.sin(df/2) * Math.sin(df/2) + Math.cos(f1) * Math.cos(f2) * Math.sin(dl/2) * Math.sin(dl/2);
                return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            };
            const cleanStrHelper = (s: string) => (s || '').replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').replace(/\s/g, '').toLowerCase();

            const allAltsRaw = Object.values(alternatives).flat();
            const globalCleanedAlts = deduplicateSpatial(allAltsRaw);

            // 기본 추천 그룹과의 교차 중복 필터링 (비어있는 이름 방어 가드 추가)
            const finalCleanedAlts = globalCleanedAlts.filter(altCard => {
                const altName = cleanStrHelper(altCard.name);
                if (!altName) return false;

                const isDupWithPrimary = primaryGroup.some(priCard => {
                    const dist = getDistHelper(altCard.lat, altCard.lng, priCard.lat, priCard.lng);
                    const priName = cleanStrHelper(priCard.name);
                    if (!priName) return false; // 비교 대상 기본 추천 장소명이 비어 있으면 스킵

                    return dist < 50 || (dist < 500 && (altName.includes(priName) || priName.includes(altName)));
                });
                return !isDupWithPrimary;
            });

            // 카테고리별로 정제된 대체 목록 재정리 및 분배
            const cleanAlts: Record<string, FactCard[]> = {};
            for (const cat of Object.keys(alternatives)) {
                cleanAlts[cat] = [];
            }
            finalCleanedAlts.forEach(card => {
                if (cleanAlts[card.category]) {
                    cleanAlts[card.category].push(card);
                } else {
                    cleanAlts[card.category] = [card];
                }
            });

            activeFacts.length = 0; activeFacts.push(...cleanActive);
            routeFacts.length = 0; routeFacts.push(...cleanRoute);
            returnFacts.length = 0; returnFacts.push(...cleanReturn);
            featuredFestival.length = 0; featuredFestival.push(...cleanFeatured);
            for (const cat of Object.keys(alternatives)) {
                alternatives[cat] = cleanAlts[cat];
            }

            const allCards = [
                ...routeFacts, ...activeFacts, ...featuredFestival, ...returnFacts,
                ...Object.values(alternatives).flat()
            ];
            allCards.forEach(card => {
                const desc = card.description || '';
                const apiSource = card.metadata?.description_api_source || '';
                
                // [v12.3.0] 1순위: 제미나이 AI가 공식 생성한 1줄 요약
                const isGeminiDescription = apiSource === 'gemini-2.5-flash';
                
                // [v12.3.0] 2순위: 백년가게 공식 인증 설명
                const isBaeknyeonDescription = desc.includes('백년가게') || desc.includes('백년가게 공식 지정');
                
                if (isGeminiDescription) {
                    // 제미나이 1줄설명 노출 (2중 노출 차단을 위해 reasoning 영역은 소거)
                    card.description = desc;
                    card.reasoning = '';
                } else if (isBaeknyeonDescription) {
                    // 백년가게 설명 노출 (2중 노출 차단을 위해 reasoning 영역은 소거)
                    card.description = desc;
                    card.reasoning = '';
                } else {
                    // 3순위: 제미나이나 백년가게 설명이 없더라도, 상세 크롤링 정보가 존재할 수 있으므로
                    // description을 강제 초기화하지 않고 보존하며, reasoning만 소거하여 중복 가이드 노출을 차단합니다.
                    card.reasoning = '';
                }
            });

            narration = stageIntros['1'];
        } catch (localBuildErr) {
            console.error('[smartPlan] Local phrase assembly failed:', localBuildErr);
            narration = "데이터를 분석하여 완벽한 여정을 짰습니다. 리스트를 스와이프하여 확인해 보세요!";
            stageIntros['1'] = narration;
        }

        // ================================================================
        // PRO 모드: 타임라인 빌더로 시간대별 타임라인 생성
        // ================================================================
        if (mode === 'PRO') {
            const { buildFullTimeline, buildCampingCards } = await import('@/lib/timelineBuilder');
            const tt = travelType || 'general';
            const days = buildFullTimeline({
                origin: origin || location,
                destination: location,
                routeData: routeData || null,
                trackBFacts: routeFacts,
                trackAFacts: activeFacts,
                alternatives,
                returnFacts,
                travelType: tt,
                startDate,
                endDate,
            });

            const proResult: ProTimelinePlan = {
                mode: 'PRO',
                travelType: tt,
                narration,
                days,
                factCards: [...routeFacts, ...activeFacts, ...returnFacts],
                alternatives,
            };

            // 캠핑 모드: 체류 구간용 카드 리스트 추가
            if (tt === 'camping') {
                proResult.campingCards = buildCampingCards(activeFacts, alternatives);
            }

            return proResult;
        }

        // ================================================================
        // BASIC 모드: 기존 로직 100% 유지
        // ================================================================
        return {
            "@context": "https://schema.org",
            "@type": "ItemList",
            narration,
            target_date: startDate.toISOString().split('T')[0],
            stageIntros: Object.keys(stageIntros).length > 0 ? stageIntros : undefined,
            stage1_timeline: stageIntros['stage1_timeline'],
            weatherBriefing,
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
