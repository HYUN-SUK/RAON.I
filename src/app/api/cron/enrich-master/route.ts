import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import proj4 from 'proj4';
import { v5 as uuidv5 } from 'uuid';

export const maxDuration = 300; // Vercel timeout 5 mins

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const NAVER_ID = process.env.NAVER_CLIENT_ID;
const NAVER_SECRET = process.env.NAVER_CLIENT_SECRET;
const GEMINI_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// Proj4 TM128 좌표계 정의
proj4.defs("TM128", "+proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43");

function tm128ToWgs84(x: number, y: number): { lat: number; lng: number } {
  try {
    const [lng, lat] = proj4("TM128", "EPSG:4326", [x, y]);
    return { lat, lng };
  } catch (e) {
    console.error(`[Proj4] Coordinate transformation failed:`, e);
    return { lat: 0, lng: 0 };
  }
}

// 1. 카테고리별 엄격한 폴백 상수 및 디폴트 메타데이터 정의
const CATEGORY_FALLBACKS: Record<string, any> = {
  RESTAURANT: {
    operating_hours: "정보 없음 (방문 전 확인 권장)",
    closed_days: "연중무휴 또는 정보 없음",
    representative_menu: [],
    price_range: "₩",
    parking_available: "확인 불가",
    pet_friendly: "확인 불가 (사전 문의 필수)",
    description: "${name}은(는) 해당 지역에 위치한 식당/카페입니다. 상세 운영 정보는 유선 확인이 필요합니다."
  },
  ROUTE_CAFE: {
    operating_hours: "정보 없음 (방문 전 확인 권장)",
    closed_days: "연중무휴 또는 정보 없음",
    representative_menu: [],
    price_range: "₩",
    parking_available: "확인 불가",
    pet_friendly: "확인 불가 (사전 문의 필수)",
    description: "${name}은(는) 해당 지역에 위치한 카페입니다. 상세 운영 정보는 유선 확인이 필요합니다."
  },
  SPOT: {
    operating_hours: "상시 개방 또는 정보 없음",
    closed_days: "연중무휴 또는 정보 없음",
    representative_menu: [],
    price_range: "무료 또는 현장 확인 필요",
    parking_available: "확인 불가",
    pet_friendly: "확인 불가",
    description: "${name}은(는) 해당 지역의 대표적인 관광명소입니다. 방문 전 개방 여부를 확인해 주세요."
  },
  MART: {
    operating_hours: "09:00 - 22:00 (점포별 상이)",
    closed_days: "매월 둘째/넷째 일요일 (지자체별 상이)",
    representative_menu: [],
    price_range: "₩",
    parking_available: "주차 가능 (일부 소형 마트 제외)",
    pet_friendly: "확인 불가",
    description: "${name}은(는) 생필품 및 식자재 구매가 가능한 마트입니다."
  },
  HOSPITAL: {
    operating_hours: "평일 09:00 - 18:00 (전화 확인 권장)",
    closed_days: "일요일/공휴일 휴무 (응급실 제외)",
    representative_menu: [],
    price_range: "₩",
    parking_available: "주차 가능",
    pet_friendly: "확인 불가",
    description: "${name}은(는) 해당 지역의 의료 시설입니다. 응급 상황 시 유선 연락 후 방문하세요."
  },
  FESTIVAL: {
    operating_hours: "행사별 상이",
    closed_days: "연중무휴 또는 정보 없음",
    representative_menu: [],
    price_range: "무료 또는 현장 확인 필요",
    parking_available: "확인 불가",
    pet_friendly: "확인 불가",
    festival_period: "일정 확인 필요 (시즌제)",
    playtime: "행사별 상이",
    admission_fee: "무료 또는 현장 확인 필요",
    homepage_url: "",
    organizer_contact: "정보 없음",
    description: "${name}은(는) 해당 지역에서 개최되는 축제/행사입니다."
  }
};

function normalizeCategory(cat: string): string {
  const c = String(cat).toUpperCase();
  if (c.includes('RESTAURANT') || c.includes('REST_')) return 'RESTAURANT';
  if (c.includes('CAFE')) return 'ROUTE_CAFE';
  if (c.includes('SPOT') || c.includes('TOUR_SPOT')) return 'SPOT';
  if (c.includes('MART')) return 'MART';
  if (c.includes('HOSPITAL')) return 'HOSPITAL';
  if (c.includes('FESTIVAL') || c.includes('FSTVL')) return 'FESTIVAL';
  return 'SPOT';
}

// 카카오 로컬 검색 API 호출
async function searchKakao(query: string, lat?: number, lng?: number): Promise<any[]> {
  if (!KAKAO_KEY) throw new Error("Missing KAKAO_REST_API_KEY");
  let url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`;
  if (lat && lng) {
    url += `&x=${lng}&y=${lat}&radius=10000`;
  }
  const res = await fetch(url, { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } });
  if (res.status === 429) throw new Error("KAKAO_QUOTA_EXCEEDED");
  if (!res.ok) throw new Error(`Kakao API Error (HTTP ${res.status})`);
  const data: any = await res.json();
  return data.documents || [];
}

// 네이버 로컬 검색 API 호출 (Fallback 용)
async function searchNaver(query: string): Promise<any[]> {
  if (!NAVER_ID || !NAVER_SECRET) throw new Error("Missing NAVER Credentials");
  const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5`;
  const res = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': NAVER_ID,
      'X-Naver-Client-Secret': NAVER_SECRET
    }
  });
  if (res.status === 429) throw new Error("NAVER_QUOTA_EXCEEDED");
  if (!res.ok) throw new Error(`Naver API Error (HTTP ${res.status})`);
  const data: any = await res.json();
  return data.items || [];
}

// 카카오/네이버 로컬 스위칭 검색
async function searchLocalUnified(name: string, address: string, lat?: number, lng?: number): Promise<{ place_url: string; phone?: string } | null> {
  const cleanAddr = address.split(' ').slice(0, 3).join(' '); // 시도 시군구 읍면동 수준으로 제한
  const query = `${cleanAddr} ${name}`;

  try {
    // 1. 카카오 시도
    const docs = await searchKakao(query, lat, lng);
    const matched = docs.find((d: any) => d.place_name.replace(/\s/g, '') === name.replace(/\s/g, '')) || docs[0];
    if (matched) {
      return { place_url: matched.place_url, phone: matched.phone };
    }
  } catch (e: any) {
    console.warn(`[Search Fallback] Kakao search failed or quota exceeded: ${e.message}. Trying Naver...`);
    try {
      // 2. 네이버 시도
      const items = await searchNaver(query);
      const matched = items.find((i: any) => i.title.replace(/<\/?[^>]+(>|$)/g, "").replace(/\s/g, '') === name.replace(/\s/g, '')) || items[0];
      if (matched) {
        const cleanName = matched.title.replace(/<\/?[^>]+(>|$)/g, "");
        return {
          place_url: matched.link || `https://search.naver.com/search.naver?query=${encodeURIComponent(cleanName)}`,
          phone: matched.telephone
        };
      }
    } catch (ne: any) {
      console.error(`[Search Fallback] Naver search also failed: ${ne.message}`);
    }
  }
  return null;
}

// 카카오 상세 모바일 JSON API 우회 파싱
async function fetchKakaoDetailJson(placeId: string): Promise<any | null> {
  const url = `https://place.map.kakao.com/main/v/${placeId}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Mobile Safari/537.36',
        'Accept': 'application/json'
      }
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const basicInfo = data.basicInfo || {};
    const menuInfo = data.menuInfo || {};

    let operating_hours = '';
    let closed_days = '';
    if (basicInfo.openHour) {
      const periodList = basicInfo.openHour.periodList || [];
      if (periodList.length > 0) {
        const timeList = periodList[0].timeList || [];
        operating_hours = timeList.map((t: any) => `${t.timeName || ''}: ${t.timePeriod || ''}`).join(', ');
        closed_days = periodList[0].offdayList?.map((o: any) => o.weekAndDay || '').join(', ') || '';
      }
    }

    const parking_available = basicInfo.parkingInfo?.parkingYn === 'Y' ? '주차 가능' : 
                              basicInfo.parkingInfo?.parkingYn === 'N' ? '주차 불가' : '확인 불가';

    const menuList = menuInfo.menuList || [];
    const representative_menu = menuList.map((m: any) => `${m.menu} (${m.price || ''})`).slice(0, 5);

    let pet_friendly = '확인 불가';
    const facilityInfo = basicInfo.facilityInfo || {};
    if (facilityInfo.pet === 'Y' || facilityInfo.petFriendly === 'Y') {
      pet_friendly = '동반 가능';
    } else if (facilityInfo.pet === 'N') {
      pet_friendly = '동반 불가';
    }

    return {
      operating_hours: operating_hours || undefined,
      closed_days: closed_days || undefined,
      representative_menu: representative_menu.length > 0 ? representative_menu : undefined,
      parking_available: parking_available !== '확인 불가' ? parking_available : undefined,
      pet_friendly: pet_friendly !== '확인 불가' ? pet_friendly : undefined
    };
  } catch (e: any) {
    console.warn(`[Scraper] Kakao JSON bypass failed for ${placeId}: ${e.message}`);
    return null;
  }
}

// 카카오 HTML 직접 스크래핑
async function scrapeKakaoDetailHtml(placeId: string): Promise<any | null> {
  const url = `https://place.map.kakao.com/m/${placeId}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    const operating_hours = $('.txt_operation').text().trim();
    const parking_text = $('.ico_parking').parent().text().trim();
    const parking_available = parking_text.includes('가능') ? '주차 가능' : 
                              parking_text.includes('불가') ? '주차 불가' : '확인 불가';

    const menus: string[] = [];
    $('.list_menu .info_menu .txt_menu').each((_, el) => {
      menus.push($(el).text().trim());
    });

    return {
      operating_hours: operating_hours || undefined,
      representative_menu: menus.length > 0 ? menus.slice(0, 5) : undefined,
      parking_available: parking_available !== '확인 불가' ? parking_available : undefined
    };
  } catch (e: any) {
    console.warn(`[Scraper] Kakao HTML scraper failed for ${placeId}: ${e.message}`);
    return null;
  }
}

// 상세 정보 수집 통합
async function getEnrichedDetails(name: string, category: string, placeUrl?: string): Promise<any> {
  const normCat = normalizeCategory(category);
  const defaultFallback = { ...CATEGORY_FALLBACKS[normCat] };

  let kakaoId = '';
  if (placeUrl && placeUrl.includes('place.map.kakao.com/')) {
    const parts = placeUrl.split('/');
    kakaoId = parts[parts.length - 1];
  }

  if (kakaoId) {
    let details = await fetchKakaoDetailJson(kakaoId);
    if (!details) {
      details = await scrapeKakaoDetailHtml(kakaoId);
    }
    if (details) {
      return {
        operating_hours: details.operating_hours || defaultFallback.operating_hours,
        closed_days: details.closed_days || defaultFallback.closed_days,
        representative_menu: details.representative_menu || defaultFallback.representative_menu,
        price_range: details.price_range || defaultFallback.price_range,
        parking_available: details.parking_available || defaultFallback.parking_available,
        pet_friendly: details.pet_friendly || defaultFallback.pet_friendly,
        description: defaultFallback.description.replace('${name}', name)
      };
    }
  }

  defaultFallback.description = defaultFallback.description.replace('${name}', name);
  return defaultFallback;
}

// Gemini 한 줄 설명 생성
async function generateGeminiDescription(name: string, category: string, details: any): Promise<string> {
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
    if (!res.ok) return details.description;
    const data: any = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || details.description;
  } catch (e: any) {
    console.warn(`[Gemini API] Failed to generate description for ${name}: ${e.message}`);
    return details.description;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');

  // 1. 크론 시크릿 인증
  if (secret !== CRON_SECRET && req.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: 'Missing environment configurations' }, { status: 500 });
  }

  const startTime = Date.now();
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  let successCount = 0;
  let failCount = 0;
  const processedList: string[] = [];

  try {
    // 2. master_places 에서 상세 정보가 아직 적재되지 않았거나, 갱신된 지 오래된 항목 조회 (하이브리드 정밀 쿼리)
    // 1단계: 아직 한 번도 갱신되지 않은 (updated_at이 null인) 데이터 우선 조회 (초고속 응답)
    let { data: places, error: fetchErr } = await supabase
      .from('master_places')
      .select('id, name, address, lat, lng, category, raw_data, description')
      .eq('is_active', true)
      .is('updated_at', null)
      .limit(40);

    if (fetchErr) throw fetchErr;

    // 2단계: null 데이터가 없으면, 이미 적재된 데이터 중 가장 오래된 순으로 조회 (인덱스 스캔 활용)
    if (!places || places.length === 0) {
      console.log("[Master Enrichment] All active master places have been enriched once. Querying oldest updated items...");
      const { data: fallbackPlaces, error: fallbackErr } = await supabase
        .from('master_places')
        .select('id, name, address, lat, lng, category, raw_data, description')
        .eq('is_active', true)
        .not('updated_at', 'is', null)
        .order('updated_at', { ascending: true })
        .limit(40);

      if (fallbackErr) throw fallbackErr;
      places = fallbackPlaces;
    }

    if (!places || places.length === 0) {
      return NextResponse.json({ success: true, message: 'No places to enrich' });
    }

    console.log(`[Master Enrichment] Selected ${places.length} places to process.`);

    for (const place of places) {
      // 타임아웃 방지: 240초(4분) 경과 시 즉시 브레이크하고 현재 결과까지 저장
      if (Date.now() - startTime > 240 * 1000) {
        console.warn(`[Master Enrichment] Timeout approaching (240s). Wrapping up current progress.`);
        break;
      }

      try {
        const name = place.name;
        const address = place.address || '';
        const category = place.category;
        let placeUrl = place.raw_data?.place_url || place.raw_data?.placeUrl || place.raw_data?.kakao_url;

        // place_url이 없는 경우 로컬 API 검색 수행
        if (!placeUrl) {
          const searchResult = await searchLocalUnified(name, address, place.lat, place.lng);
          if (searchResult) {
            placeUrl = searchResult.place_url;
          }
        }

        // 상세 크롤링 실행
        const details = await getEnrichedDetails(name, category, placeUrl);

        // Gemini AI 1.5 Flash 한 줄 요약 생성
        let finalDescription = place.description;
        const hasNoDesc = !place.description || place.description.includes('해당 지역에 위치한');
        if (hasNoDesc && GEMINI_KEY) {
          finalDescription = await generateGeminiDescription(name, category, details);
          // Gemini API RPM(분당 15회) 및 RPD 무료 쿼터 보호를 위한 4.5초 Throttling 대기
          await new Promise(r => setTimeout(r, 4500));
        } else {
          // 크롤링 Anti-Scraping 차단 우회를 위한 랜덤 딜레이 (1.5 ~ 3초)
          const delay = 1500 + Math.random() * 1500;
          await new Promise(r => setTimeout(r, delay));
        }

        // 마스터 데이터 필드 병합
        const updatedRaw = {
          ...(place.raw_data || {}),
          enriched: true,
          place_url: placeUrl || place.raw_data?.place_url,
          operating_hours: details.operating_hours,
          closed_days: details.closed_days,
          representative_menu: details.representative_menu,
          parking_available: details.parking_available,
          pet_friendly: details.pet_friendly
        };

        // DB 갱신 (master_places)
        const { error: updateErr } = await supabase
          .from('master_places')
          .update({
            raw_data: updatedRaw,
            description: finalDescription || details.description,
            updated_at: new Date().toISOString()
          })
          .eq('id', place.id);

        if (updateErr) {
          console.error(`[DB Error] Failed to update place ${name}: ${updateErr.message}`);
          failCount++;
        } else {
          successCount++;
          processedList.push(name);
        }

      } catch (err: any) {
        console.error(`[Master Enrichment] Error enriching ${place.name}: ${err.message}`);
        failCount++;
      }
    }

    const duration = Date.now() - startTime;

    // 3. automation_logs에 배치 수행 결과 기록
    await supabase.from('automation_logs').insert({
      job_name: 'DAILY_MASTER_ENRICHMENT',
      status: successCount > 0 ? 'SUCCESS' : 'FAILURE',
      processed_count: successCount,
      message: `일일 마스터 상세 정보 분산 적재 완료: 성공 ${successCount}건, 실패 ${failCount}건.`,
      duration_ms: duration,
      api_status: {
        attempted: successCount + failCount,
        success: successCount,
        failed: failCount,
        processed: processedList
      },
      created_at: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      processed: successCount,
      failed: failCount,
      duration_ms: duration,
      list: processedList
    });

  } catch (error: any) {
    console.error(`[Master Enrichment] Fatal Error:`, error.message);

    await supabase.from('automation_logs').insert({
      job_name: 'DAILY_MASTER_ENRICHMENT',
      status: 'FAILURE',
      processed_count: 0,
      message: `일일 마스터 상세 정보 분산 적재 치명적 실패: ${error.message}`,
      duration_ms: Date.now() - startTime,
      created_at: new Date().toISOString()
    });

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
