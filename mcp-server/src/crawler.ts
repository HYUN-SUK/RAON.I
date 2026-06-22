import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export interface EnrichedDetail {
  operating_hours: string;
  closed_days: string;
  representative_menu: string[];
  price_range: string;
  parking_available: string;
  pet_friendly: string;
  description?: string;
  
  // 축제 전용 필드
  festival_period?: string;
  playtime?: string;
  admission_fee?: string;
  homepage_url?: string;
  organizer_contact?: string;
  sub_description?: string;
}

// 1. 카테고리별 엄격한 디폴트/폴백 상수 정의
export const CATEGORY_FALLBACKS: Record<string, EnrichedDetail> = {
  RESTAURANT: {
    operating_hours: "정보 없음 (방문 전 확인 권장)",
    closed_days: "연중무휴 또는 정보 없음",
    representative_menu: [],
    price_range: "₩",
    parking_available: "확인 불가",
    pet_friendly: "확인 불가 (사전 문의 필수)",
    description: "해당 지역에 위치한 식당/카페입니다. 상세 운영 정보는 유선 확인이 필요합니다."
  },
  ROUTE_CAFE: {
    operating_hours: "정보 없음 (방문 전 확인 권장)",
    closed_days: "연중무휴 또는 정보 없음",
    representative_menu: [],
    price_range: "₩",
    parking_available: "확인 불가",
    pet_friendly: "확인 불가 (사전 문의 필수)",
    description: "해당 지역에 위치한 카페입니다. 상세 운영 정보는 유선 확인이 필요합니다."
  },
  SPOT: {
    operating_hours: "상시 개방 또는 정보 없음",
    closed_days: "연중무휴 또는 정보 없음",
    representative_menu: [],
    price_range: "무료 또는 현장 확인 필요",
    parking_available: "확인 불가",
    pet_friendly: "확인 불가",
    description: "해당 지역의 대표적인 관광명소입니다. 방문 전 개방 여부를 확인해 주세요."
  },
  MART: {
    operating_hours: "09:00 - 22:00 (점포별 상이)",
    closed_days: "매월 둘째/넷째 일요일 (지자체별 상이)",
    representative_menu: [],
    price_range: "₩",
    parking_available: "주차 가능 (일부 소형 마트 제외)",
    pet_friendly: "확인 불가",
    description: "생필품 및 식자재 구매가 가능한 마트입니다."
  },
  HOSPITAL: {
    operating_hours: "평일 09:00 - 18:00 (전화 확인 권장)",
    closed_days: "일요일/공휴일 휴무 (응급실 제외)",
    representative_menu: [],
    price_range: "₩",
    parking_available: "주차 가능",
    pet_friendly: "확인 불가",
    description: "해당 지역의 의료 시설입니다. 응급 상황 시 유선 연락 후 방문하세요."
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
    description: "해당 지역에서 개최되는 축제/행사입니다."
  }
};

/**
 * 카테고리 명칭 정규화 헬퍼
 */
export function normalizeCategory(cat: string): string {
  const c = String(cat).toUpperCase();
  if (c.includes('RESTAURANT') || c.includes('REST_')) return 'RESTAURANT';
  if (c.includes('CAFE')) return 'ROUTE_CAFE';
  if (c.includes('SPOT') || c.includes('TOUR_SPOT')) return 'SPOT';
  if (c.includes('MART')) return 'MART';
  if (c.includes('HOSPITAL')) return 'HOSPITAL';
  if (c.includes('FESTIVAL') || c.includes('FSTVL')) return 'FESTIVAL';
  return 'SPOT'; // 기본 폴백
}

/**
 * 카카오 상세 모바일 JSON API 우회 파싱
 */
async function fetchKakaoDetailViaJson(placeId: string): Promise<Partial<EnrichedDetail> | null> {
  const url = `https://place.map.kakao.com/main/v/${placeId}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Mobile Safari/537.36',
        'Accept': 'application/json'
      },
      signal: controller.signal as any
    });
    clearTimeout(timeoutId);
    
    if (!res.ok) return null;
    
    const data: any = await res.json();
    const basicInfo = data.basicInfo || {};
    const menuInfo = data.menuInfo || {};
    
    // 영업시간 추출
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
    
    // 주차 정보 추출
    const parking_available = basicInfo.parkingInfo?.parkingYn === 'Y' ? '주차 가능' : 
                              basicInfo.parkingInfo?.parkingYn === 'N' ? '주차 불가' : '확인 불가';
    
    // 메뉴 리스트 추출
    const menuList = menuInfo.menuList || [];
    const representative_menu = menuList.map((m: any) => `${m.menu} (${m.price || ''})`).slice(0, 5);
    
    // 애견동반 등 시설 태그 분석
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

/**
 * 카카오 상세 웹 HTML 스크래핑 (JSON API 실패 시 Fallback)
 */
async function scrapeKakaoDetailViaHtml(placeId: string): Promise<Partial<EnrichedDetail> | null> {
  const url = `https://place.map.kakao.com/m/${placeId}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: controller.signal as any
    });
    clearTimeout(timeoutId);
    
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

/**
 * 특정 장소의 풍부한 상세 정보(Enriched Details) 획득 통합 스크립트
 */
export async function getPlaceEnrichedDetails(
  placeName: string,
  category: string,
  placeUrl?: string
): Promise<EnrichedDetail> {
  const normCat = normalizeCategory(category);
  const defaultFallback = { ...CATEGORY_FALLBACKS[normCat] };
  
  // 1. 카카오 플레이스 ID 추출 시도
  let kakaoId = '';
  if (placeUrl && placeUrl.includes('place.map.kakao.com/')) {
    const parts = placeUrl.split('/');
    kakaoId = parts[parts.length - 1];
  }

  if (kakaoId) {
    // 2. 1차 시도: 카카오 모바일 JSON API 우회
    let details = await fetchKakaoDetailViaJson(kakaoId);
    
    // 3. 2차 시도: HTML 스크래핑
    if (!details) {
      details = await scrapeKakaoDetailViaHtml(kakaoId);
    }
    
    // 4. 병합 및 폴백 적용
    if (details) {
      return {
        operating_hours: details.operating_hours || defaultFallback.operating_hours,
        closed_days: details.closed_days || defaultFallback.closed_days,
        representative_menu: details.representative_menu || defaultFallback.representative_menu,
        price_range: details.price_range || defaultFallback.price_range,
        parking_available: details.parking_available || defaultFallback.parking_available,
        pet_friendly: details.pet_friendly || defaultFallback.pet_friendly,
        description: defaultFallback.description?.replace('${name}', placeName)
      };
    }
  }

  // 5. ID가 없거나 완전히 수집 실패 시 기본 폴백 상수 적용 및 커스텀 메시지 치환
  defaultFallback.description = defaultFallback.description?.replace('${name}', placeName);
  return defaultFallback;
}

/**
 * TourAPI 축제 데이터를 규격화된 상세 스펙으로 포맷팅
 */
export function formatFestivalDetails(item: any): EnrichedDetail {
  const name = item.title || '축제 정보';
  const defaultFallback = { ...CATEGORY_FALLBACKS.FESTIVAL };
  
  return {
    operating_hours: item.playtime || defaultFallback.operating_hours,
    closed_days: defaultFallback.closed_days,
    representative_menu: [],
    price_range: item.usefee ? (item.usefee.includes('무료') ? '무료' : '유료') : defaultFallback.price_range,
    parking_available: item.parking || defaultFallback.parking_available,
    pet_friendly: defaultFallback.pet_friendly,
    
    // 축제 특화 스펙 10개 완벽 매핑
    festival_period: (item.eventstartdate && item.eventenddate) ? 
                      `${item.eventstartdate} - ${item.eventenddate}` : defaultFallback.festival_period,
    playtime: item.playtime || defaultFallback.playtime,
    admission_fee: item.usefee || defaultFallback.admission_fee,
    homepage_url: item.homepage_url || '',
    organizer_contact: item.sponsor1tel || item.sponsor2tel || defaultFallback.organizer_contact,
    sub_description: item.sub_description || item.title || '',
    description: `${name}은(는) ${item.eventstartdate || ''}부터 진행되는 행사입니다.`
  };
}
