import fetch from 'node-fetch';
import proj4 from 'proj4';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env.local' }); // 프로젝트 루트의 .env.local 로드

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const NAVER_ID = process.env.NAVER_CLIENT_ID;
const NAVER_SECRET = process.env.NAVER_CLIENT_SECRET;

// Proj4 좌표계 정의: TM128 (Bessel) <-> WGS84 (GRS80/GPS)
proj4.defs("TM128", "+proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43");

export interface StandardPlace {
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  source: 'KAKAO' | 'NAVER';
  source_id?: string;
  place_url?: string;
}

// 메모리 기반 일일 호출 카운터 (서버 기동 시 초기화되나 사후 429 catch로 보완)
let kakaoCallCount = 0;
let lastResetDate = getTodayString();

function getTodayString(): string {
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(Date.now() + kstOffset);
  return kstDate.toISOString().split('T')[0];
}

function checkAndResetCounter() {
  const today = getTodayString();
  if (lastResetDate !== today) {
    kakaoCallCount = 0;
    lastResetDate = today;
    console.log(`[Counter] Reset Kakao call counter for new day: ${today}`);
  }
}

/**
 * 네이버 TM128 좌표를 Gps GRS80 (lat, lng) 위경도로 변환
 */
export function tm128ToWgs84(x: number, y: number): { lat: number; lng: number } {
  try {
    const [lng, lat] = proj4("TM128", "EPSG:4326", [x, y]);
    return { lat, lng };
  } catch (e) {
    console.error(`[Proj4] Coordinate transformation failed:`, e);
    return { lat: 0, lng: 0 };
  }
}

/**
 * 카카오 키워드 로컬 API 검색 수행
 */
async function searchKakao(query: string, lat?: number, lng?: number, radius?: number): Promise<StandardPlace[]> {
  if (!KAKAO_KEY) {
    throw new Error("Missing KAKAO_REST_API_KEY");
  }

  let url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`;
  if (lat !== undefined && lng !== undefined) {
    url += `&x=${lng}&y=${lat}`;
    if (radius !== undefined) {
      url += `&radius=${Math.min(radius, 20000)}`; // 카카오 최대 반경 20km 제한
    }
  }

  const res = await fetch(url, {
    headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` }
  });

  if (res.status === 429) {
    throw new Error("KAKAO_QUOTA_EXCEEDED");
  }

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Kakao API Error (HTTP ${res.status}): ${errorText}`);
  }

  const data: any = await res.json();
  const docs = data.documents || [];

  return docs.map((doc: any) => ({
    name: doc.place_name,
    address: doc.road_address_name || doc.address_name || '주소 정보 없음',
    lat: parseFloat(doc.y),
    lng: parseFloat(doc.x),
    phone: doc.phone || '전화번호 없음',
    source: 'KAKAO',
    source_id: doc.id,
    place_url: doc.place_url
  }));
}

/**
 * 네이버 지역 검색 API 수행
 */
async function searchNaver(query: string): Promise<StandardPlace[]> {
  if (!NAVER_ID || !NAVER_SECRET) {
    throw new Error("Missing NAVER_CLIENT_ID or NAVER_CLIENT_SECRET");
  }

  const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=15`;
  const res = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': NAVER_ID,
      'X-Naver-Client-Secret': NAVER_SECRET
    }
  });

  if (res.status === 429) {
    throw new Error("NAVER_QUOTA_EXCEEDED");
  }

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Naver API Error (HTTP ${res.status}): ${errorText}`);
  }

  const data: any = await res.json();
  const items = data.items || [];

  return items.map((item: any) => {
    // HTML 태그 제거 (네이버 검색 결과에는 <b>태그 등이 포함됨)
    const cleanName = item.title.replace(/<\/?[^>]+(>|$)/g, "");
    
    // 네이버 TM128 좌표를 위경도로 변환
    const mapX = parseInt(item.mapx, 10);
    const mapY = parseInt(item.mapy, 10);
    const { lat, lng } = tm128ToWgs84(mapX, mapY);

    return {
      name: cleanName,
      address: item.roadAddress || item.address || '주소 정보 없음',
      lat: lat,
      lng: lng,
      phone: item.telephone || '전화번호 없음',
      source: 'NAVER',
      place_url: item.link || `https://search.naver.com/search.naver?query=${encodeURIComponent(cleanName)}`
    };
  });
}

/**
 * 통합 로컬 검색 API (카카오를 주력으로 쓰고 소진/장애 시 네이버로 Fallback)
 */
export async function searchPlacesUnified(
  query: string, 
  lat?: number, 
  lng?: number, 
  radius?: number
): Promise<StandardPlace[]> {
  checkAndResetCounter();

  // 1. 카카오 호출 횟수가 사전 제어 소프트 한도(98,000건) 미만이고 네이버 키가 있으면 카카오 우선 시도
  const useKakao = kakaoCallCount < 98000;

  if (useKakao) {
    try {
      kakaoCallCount++;
      // console.log(`[API Client] Calling Kakao API (Daily count: ${kakaoCallCount})...`);
      return await searchKakao(query, lat, lng, radius);
    } catch (e: any) {
      console.warn(`[API Client] Kakao search failed or exceeded: ${e.message}. Switching to Naver Fallback...`);
      // 카카오 쿼터 한도 에러(HTTP 429 등) 혹은 기타 에러 발생 시 즉시 네이버 시도
      if (NAVER_ID && NAVER_SECRET) {
        return await searchNaver(query);
      } else {
        throw new Error(`Kakao failed and Naver API Key is not configured: ${e.message}`);
      }
    }
  } else {
    // 카카오 쿼터가 이미 소진된 상태 (98,000회 이상)
    console.warn(`[API Client] Kakao daily soft-limit reached (${kakaoCallCount}). Bypassing to Naver Local API...`);
    if (NAVER_ID && NAVER_SECRET) {
      return await searchNaver(query);
    } else {
      console.warn(`[API Client] Naver key is missing, continuing with Kakao despite limit danger...`);
      return await searchKakao(query, lat, lng, radius);
    }
  }
}
