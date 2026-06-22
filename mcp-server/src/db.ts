import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import proj4 from 'proj4';
import ws from 'ws';
import { v5 as uuidv5 } from 'uuid';
import { getPlaceEnrichedDetails, normalizeCategory, EnrichedDetail } from './crawler.js';

dotenv.config({ path: '../.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPINET_KEY = process.env.OPINET_API_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const GEMINI_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials in environment variables.");
}

// Supabase 관리자 권한 클라이언트 생성 (RLS 우회 및 쓰기 허용)
export const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!, {
  auth: { persistSession: false },
  realtime: { transport: ws as any }
});

// Proj4: TM128 좌표 변환 정의
proj4.defs("TM128", "+proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43");

const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// Fact 고유 ID 생성 로직 (기존 프로덕션 로직과 100% 동일한 UUIDv5 생성)
function generateFactId(source: string, name: string, address: string): string {
  const cleanSource = source.trim();
  const cleanName = name.trim();
  const cleanAddr = address.trim();
  return uuidv5(`${cleanSource}|${cleanName}|${cleanAddr}`, MY_NAMESPACE);
}

/**
 * Gemini 1.5 Flash API를 활용하여 정제된 한 줄 설명(Description) 사전 적재
 */
export async function generateGeminiDescription(name: string, category: string, details: EnrichedDetail): Promise<string> {
  if (!GEMINI_KEY) {
    return details.description || `${name}은(는) 해당 지역에 위치한 장소입니다.`;
  }

  const prompt = `당신은 캠핑/여행 전문 AI 카피라이터입니다.
다음 장소의 메타데이터를 기반으로, 여행자(캠퍼)들에게 유용하고 매력적인 한 줄 요약(Description)을 작성해 주세요.

[장소 정보]
- 이름: ${name}
- 카테고리: ${category}
- 영업시간: ${details.operating_hours}
- 휴무일: ${details.closed_days}
- 대표메뉴/특징: ${details.representative_menu?.join(', ') || '없음'}
- 주차여부: ${details.parking_available}
- 반려동물동반: ${details.pet_friendly}

[주의사항]
1. 반드시 한국어로 작성하세요.
2. 딱 한 문장(30자 내외)의 간결하고 완성도 높은 문장이어야 합니다.
3. 소설을 쓰거나 없는 정보를 환각(Hallucination)으로 꾸며내지 마세요.
4. 마크다운 기호나 이모티콘은 사용하지 마세요.

한 줄 요약:`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 60 }
      })
    });

    if (!res.ok) return details.description || `${name}은(는) 해당 지역의 장소입니다.`;

    const data: any = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || details.description || `${name}은(는) 해당 지역의 장소입니다.`;
  } catch (e: any) {
    console.warn(`[Gemini API] Failed to generate description for ${name}: ${e.message}`);
    return details.description || `${name}은(는) 해당 지역의 장소입니다.`;
  }
}

/**
 * API Key 검증 함수
 */
export async function validateApiKey(apiKey: string): Promise<{ isValid: boolean; tier?: string; keyId?: string }> {
  try {
    // API 키 해싱 (SHA-256)
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const apiKeyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const { data: keyRecord, error } = await supabase
      .from('mcp_api_keys')
      .select('id, tier, is_active')
      .eq('api_key_hash', apiKeyHash)
      .maybeSingle();

    if (error || !keyRecord || !keyRecord.is_active) {
      return { isValid: false };
    }

    // 마지막 사용 시각 기록 (Async)
    supabase.from('mcp_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRecord.id).then();

    return { isValid: true, tier: keyRecord.tier, keyId: keyRecord.id };
  } catch (e) {
    console.error(`[Auth] ApiKey validation error:`, e);
    return { isValid: false };
  }
}

/**
 * 호출 내역 로깅
 */
export async function logMcpUsage(keyId: string, toolName: string, success: boolean, executionTimeMs: number) {
  try {
    await supabase.from('mcp_usage_logs').insert({
      api_key_id: keyId,
      tool_name: toolName,
      success,
      execution_time_ms: executionTimeMs
    });
  } catch (e: any) {
    console.error(`[Usage Log] Failed to insert log:`, e.message);
  }
}

/**
 * search_places: 반경 내 정제 장소 조회
 */
export async function searchPlacesDb(lat: number, lng: number, radiusMeters: number, category?: string) {
  const query = supabase.rpc('get_smart_plan_facts_in_radius', {
    center_lat: lat,
    center_lng: lng,
    radius_meters: radiusMeters
  });

  const { data, error } = await query;
  if (error) throw error;

  const filtered = category ? (data || []).filter((f: any) => f.category === normalizeCategory(category)) : (data || []);
  return filtered.slice(0, 50); // 최대 50개 제한
}

/**
 * get_place_details: 장소 상세 정보 조회 (온디맨드 캐싱 적용)
 */
export async function getPlaceDetailsDb(placeId: string) {
  const { data: fact, error } = await supabase
    .from('smart_plan_facts')
    .select('*')
    .eq('id', placeId)
    .maybeSingle();

  if (error) throw error;
  if (!fact) return null;

  const lastUpdated = fact.updated_at ? new Date(fact.updated_at).getTime() : 0;
  const isExpired = (Date.now() - lastUpdated) > 100 * 24 * 60 * 60 * 1000; // 100일 경과 여부
  const hasNoDetails = !fact.raw_data || !fact.raw_data.enriched;

  if (isExpired || hasNoDetails) {
    console.log(`[Lazy Load] Enriching details for: ${fact.name} (${placeId})...`);
    
    // 카카오맵 크롤러를 통해 영업시간 등 획득
    const enriched = await getPlaceEnrichedDetails(fact.name, fact.category, fact.raw_data?.place_url);
    
    // AI 요약 설명 사전 빌드
    const isDescriptionDefault = !fact.description || fact.description.includes('해당 지역에 위치한');
    let finalDescription = fact.description;
    
    if (isDescriptionDefault) {
      finalDescription = await generateGeminiDescription(fact.name, fact.category, enriched);
    }

    const updatedRaw = {
      ...(fact.raw_data || {}),
      enriched: true,
      operating_hours: enriched.operating_hours,
      closed_days: enriched.closed_days,
      representative_menu: enriched.representative_menu,
      parking_available: enriched.parking_available,
      pet_friendly: enriched.pet_friendly
    };

    // DB 갱신
    const { data: updatedFact, error: updateErr } = await supabase
      .from('smart_plan_facts')
      .update({
        raw_data: updatedRaw,
        description: finalDescription,
        updated_at: new Date().toISOString()
      })
      .eq('id', placeId)
      .select()
      .single();

    if (!updateErr && updatedFact) {
      return updatedFact;
    }
  }

  return fact;
}

/**
 * get_nearby_facilities: 주변 인프라 조회 (주유소 2단계 캐싱 적용)
 */
export async function getNearbyFacilitiesDb(lat: number, lng: number, facilityType: 'HOSPITAL' | 'GAS_STATION' | 'MART') {
  if (facilityType === 'HOSPITAL' || facilityType === 'MART') {
    // 병원, 마트는 기존 DB 내에서 Radius 조회 수행
    const category = facilityType === 'HOSPITAL' ? 'MART_HOSPITAL' : 'MART';
    const { data, error } = await supabase.rpc('get_smart_plan_facts_in_radius', {
      center_lat: lat,
      center_lng: lng,
      radius_meters: 10000 // 기본 10km
    });
    if (error) throw error;
    return (data || []).filter((f: any) => f.category === category).slice(0, 15);
  }

  // GAS_STATION (주유소) - 2단계 온디맨드 지리적 캐싱
  const radiusMeters = 5000; // 5km 반경

  // 1단계: DB 캐시 검증 (최근 24시간 이내 업데이트된 주유소가 반경 내에 존재하는지)
  const { data: dbGasList, error: dbErr } = await supabase.rpc('get_smart_plan_facts_in_radius', {
    center_lat: lat,
    center_lng: lng,
    radius_meters: radiusMeters
  });

  const cachedGas = (dbGasList || []).filter((f: any) => f.category === 'GAS_STATION');
  const now = Date.now();
  const validCache = cachedGas.length > 0 && cachedGas.every((g: any) => {
    const upd = g.updated_at ? new Date(g.updated_at).getTime() : 0;
    return (now - upd) < 24 * 60 * 60 * 1000; // 24시간 이내
  });

  if (validCache) {
    // console.log(`[Cache Hit] Using valid DB cached gas stations (0.01s)...`);
    return cachedGas.slice(0, 10);
  }

  // 2단계: 캐시가 없거나 만료됨 -> 오피넷 실시간 API 호출 및 DB Upsert (Fail-Safe 구조)
  // console.log(`[Cache Miss] Calling OPINET API for gas stations...`);
  if (!OPINET_KEY) {
    // API 키가 없으면 DB의 기존 데이터라도 Fallback 리턴
    return cachedGas.slice(0, 10);
  }

  try {
    // 2-1) WGS84 -> TM128 좌표 변환
    const [wtmX, wtmY] = proj4("EPSG:4326", "TM128", [lng, lat]);
    
    // 2-2) 오피넷 실내등유 주유소 반경 조회
    const url = `http://www.opinet.co.kr/api/aroundAll.do?code=${OPINET_KEY}&x=${Math.round(wtmX)}&y=${Math.round(wtmY)}&radius=${radiusMeters}&sort=1&prodcd=C004&out=json`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 800);
    const res = await fetch(url, { signal: controller.signal as any });
    clearTimeout(timeoutId);
    
    if (!res.ok) throw new Error(`Opinet HTTP Error ${res.status}`);
    
    const resData: any = await res.json();
    const items = resData.RESULT?.OIL || [];
    const gasItems = Array.isArray(items) ? items : [items];
    
    const processedFacts: any[] = [];
    
    for (const item of gasItems) {
      if (!item.OS_NM) continue;
      const price = parseFloat(item.PRICE || "0");
      if (price <= 0) continue;

      const [gLon, gLat] = proj4("TM128", "EPSG:4326", [parseFloat(item.GIS_X_COOR), parseFloat(item.GIS_Y_COOR)]);
      const addr = item.VAN_ADR || item.NEW_ADR || '주소 정보 없음';
      const fid = generateFactId('OPINET_GAS', item.OS_NM, addr);

      processedFacts.push({
        id: fid,
        api_source: 'OPINET_GAS',
        category: 'GAS_STATION',
        name: item.OS_NM,
        description: `실내등유: ${price}원`,
        address: addr,
        lat: gLat,
        lng: gLon,
        trust_score: 55,
        raw_data: item,
        updated_at: new Date().toISOString()
      });
    }

    if (processedFacts.length > 0) {
      // DB 영구 적재 (Upsert)
      const { error: upsertErr } = await supabase
        .from('smart_plan_facts')
        .upsert(processedFacts, { onConflict: 'id' });

      if (upsertErr) console.error(`[DB] Gas Station Upsert failed:`, upsertErr.message);
      return processedFacts.slice(0, 10);
    }
  } catch (e: any) {
    console.warn(`[Fail-Safe] OPINET call failed: ${e.message}. Falling back to old DB records.`);
    // 외부 API 지연/에러 시 DB에 있는 기존 캐시 데이터를 즉시 폴백하여 리턴 (절대 장애 전파 금지)
    return cachedGas.slice(0, 10);
  }

  return cachedGas.slice(0, 10);
}

/**
 * get_travel_plan_template: 여행 계획 템플릿 반환
 */
export async function getTravelPlanTemplateDb(
  reservationId?: string,
  lat?: number,
  lng?: number,
  durationDays?: number,
  companions?: string[]
) {
  let metadata = {
    duration_days: durationDays || 2,
    companions: companions || ["성인 2"],
    start_date: "",
    end_date: "",
    campground_name: "미정"
  };
  
  let candidates: any[] = [];

  // 1. 예약 ID 기반 (1st Party)
  if (reservationId) {
    // 1-1) 예약 정보 조회
    const { data: reservation, error: resErr } = await supabase
      .from('reservations')
      .select('check_in, check_out, site_name, guest_details, campground_id')
      .eq('id', reservationId)
      .maybeSingle();

    if (!resErr && reservation) {
      const checkIn = new Date(reservation.check_in);
      const checkOut = new Date(reservation.check_out);
      const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      metadata.duration_days = days || 2;
      metadata.start_date = reservation.check_in;
      metadata.end_date = reservation.check_out;
      metadata.campground_name = reservation.site_name || "캠핑장";

      const guests = reservation.guest_details || {};
      const compList = [`성인 ${guests.adults || 2}`];
      if (guests.seniors > 0) compList.push(`어르신 ${guests.seniors}`);
      if (guests.kids?.preschool > 0) compList.push(`미취학아동 ${guests.kids.preschool}`);
      if (guests.kids?.elementary > 0) compList.push(`초등학생 ${guests.kids.elementary}`);
      if (guests.hasPet) compList.push(`반려동물 동반`);
      metadata.companions = compList;
    }

    // 1-2) D-3/D-7 개인화 캐시 후보군 조회
    const { data: dbCands } = await supabase
      .from('smart_plan_candidates')
      .select('name, category, address, lat, lng, final_score, raw_data')
      .eq('reservation_id', reservationId);

    if (dbCands && dbCands.length > 0) {
      candidates = dbCands;
    }
  }

  // 2. 범용 위치 기반 (3rd Party - 예약 ID가 없거나 후보군이 없는 경우 실시간 공간 쿼리 빌드)
  if (candidates.length === 0 && lat !== undefined && lng !== undefined) {
    const { data: dbFacts } = await supabase.rpc('get_smart_plan_facts_in_radius', {
      center_lat: lat,
      center_lng: lng,
      radius_meters: 15000 // 15km 반경 내 마스터 데이터 실시간 정제
    });

    if (dbFacts) {
      // 카테고리별 쿼터 선별 (식당 10, 명소 10, 마트 5)
      const restaurants = dbFacts.filter((f: any) => f.category === 'RESTAURANT' || f.category === 'ROUTE_CAFE').slice(0, 10);
      const spots = dbFacts.filter((f: any) => f.category === 'SPOT').slice(0, 10);
      const marts = dbFacts.filter((f: any) => f.category === 'MART').slice(0, 5);
      candidates = [...restaurants, ...spots, ...marts];
    }
  }

  // 날씨 요약 힌트 생성 (실제 구현 시 기상 캐시 조인)
  const weatherSummary = "대체로 맑음, 강수확률 10%, 최고기온 22도, 최저기온 14도";

  // 시스템 지침서 텍스트 조립
  const system_prompt_guide = `당신은 캠핑 및 여행 전문 인공지능 플래너입니다.
제공된 [여행자 정보] 및 [추천 장소 후보군] 데이터를 바탕으로, 일자별/시간별 상세 캠핑 여행 일정을 수립해 주세요.

[요구사항]
1. 여행 기간(${metadata.duration_days}일)에 맞추어 1일차부터 N일차까지 09:00 ~ 21:00 사이의 시간 블록 일정들을 조립하세요.
2. 동반 구성원(${metadata.companions.join(', ')})을 배려하세요. (예: 어르신이 있는 경우 격렬한 도보/등산 배제, 어린이가 있는 경우 키즈존 포함, 반려동물이 있으면 반려동물 동반 가능 장소 우선)
3. 장소 간 지리적 이동 거리를 직관적으로 고려하여 동선을 효율적으로 배치해 주세요.
4. 반드시 다음의 엄격한 JSON 배열 형식으로만 응답을 반환해 주세요. 자연어 대화 텍스트는 절대 포함하지 마세요.

[출력 JSON Schema]
\`\`\`json
[
  {
    "day": 1,
    "schedule": [
      {
        "time": "09:00",
        "place_name": "장소이름",
        "address": "장소주소",
        "activity": "할 활동 요약",
        "tip": "이동 거리 고려 사항 또는 안내 팁"
      }
    ]
  }
]
\`\`\``;

  return {
    metadata: {
      ...metadata,
      weather_summary: weatherSummary
    },
    place_candidates: candidates.map(c => ({
      name: c.name,
      category: c.category,
      address: c.address,
      lat: c.lat,
      lng: c.lng,
      description: c.description || c.raw_data?.description || '상세 정보 없음'
    })),
    system_prompt_guide
  };
}
