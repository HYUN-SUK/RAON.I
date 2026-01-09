import { NextRequest, NextResponse } from 'next/server';

/**
 * 주변 행사 통합 API
 * 1. 한국관광공사 TourAPI (searchFestival2)
 * 2. 전국공연행사정보표준데이터
 * 3. 전국문화축제표준데이터
 * 
 * 사용자 위치(lat, lng) 기준 반경 30km 내 행사 조회 및 통합 정렬
 */

const TOUR_API_KEY = process.env.TOUR_API_KEY || '03e41a022f4e6033f803beff860f41460f071cc9482e2532db99c142505f9df2';

// API Endpoints
const API_URLS = {
    TOUR: 'https://apis.data.go.kr/B551011/KorService2/searchFestival2',
    PERFORMANCE: 'http://api.data.go.kr/openapi/tn_pubr_public_pblprfr_event_info_api',
    FESTIVAL: 'http://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api'
};

// 공통 이벤트 구조
interface NormalizedEvent {
    id: string;
    title: string;
    description: string;
    location: string;
    latitude: number;
    longitude: number;
    start_date: string; // YYYY.MM.DD
    end_date: string;   // YYYY.MM.DD
    image_url: string | null;
    phone: string | null;
    distance_km: number;
    detail_url: string | null;
    source: 'tourapi' | 'performance' | 'festival';
}

// Haversine 거리 계산 (km)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// 날짜 포맷 변환 (YYYYMMDD or YYYY-MM-DD -> YYYY.MM.DD)
function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const cleanStr = dateStr.replace(/-/g, '');
    if (cleanStr.length === 8) {
        return `${cleanStr.substring(0, 4)}.${cleanStr.substring(4, 6)}.${cleanStr.substring(6, 8)}`;
    }
    return dateStr;
}

// 날짜 비교용 숫자 변환 (YYYY.MM.DD -> YYYYMMDD)
function getDateNumber(dateStr: string): number {
    return parseInt(dateStr.replace(/\./g, ''), 10);
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const lat = parseFloat(searchParams.get('lat') || '36.67');
        const lng = parseFloat(searchParams.get('lng') || '126.83');
        const radius = parseFloat(searchParams.get('radius') || '30000');
        const radiusKm = radius / 1000;

        const today = new Date();
        const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
        const todayNum = parseInt(todayStr, 10);

        if (!TOUR_API_KEY) {
            return NextResponse.json({ success: true, source: 'no_api_key', events: [], message: 'API 키가 설정되지 않았습니다.' });
        }

        // 3개 API 병렬 호출
        const fetchWithDebug = async (url: string) => {
            try {
                // HTTP 프로토콜 사용 (SSL 문제 회피)
                const res = await fetch(url, { next: { revalidate: 3600 } });
                const text = await res.text();
                try {
                    return JSON.parse(text);
                } catch {
                    // 키 에러 시 XML 또는 Plain Text 반환됨 -> 에러 메시지로 활용
                    throw new Error(text);
                }
            } catch (e) {
                throw e;
            }
        };

        // 3개 API 병렬 호출
        const [tourRes, perfRes, festRes] = await Promise.allSettled([
            // 1. TourAPI (searchFestival2)
            fetchWithDebug(`${API_URLS.TOUR}?serviceKey=${TOUR_API_KEY}&MobileOS=ETC&MobileApp=RAONI&_type=json&numOfRows=100&arrange=S&eventStartDate=${todayStr}`),

            // 2. 전국공연행사정보표준데이터
            fetchWithDebug(`${API_URLS.PERFORMANCE}?serviceKey=${TOUR_API_KEY}&type=json&numOfRows=1000&pageNo=1`),

            // 3. 전국문화축제표준데이터
            fetchWithDebug(`${API_URLS.FESTIVAL}?serviceKey=${TOUR_API_KEY}&type=json&numOfRows=1000&pageNo=1`)
        ]);

        let allEvents: NormalizedEvent[] = [];

        // 1. TourAPI 데이터 처리
        if (tourRes.status === 'fulfilled' && tourRes.value?.response?.body?.items?.item) {
            const items = Array.isArray(tourRes.value.response.body.items.item)
                ? tourRes.value.response.body.items.item
                : [tourRes.value.response.body.items.item];

            items.forEach((item: any) => {
                const itemLat = parseFloat(item.mapy);
                const itemLng = parseFloat(item.mapx);
                if (!isNaN(itemLat) && !isNaN(itemLng)) {
                    const dist = calculateDistance(lat, lng, itemLat, itemLng);
                    if (dist <= radiusKm) {
                        allEvents.push({
                            id: `tour_${item.contentid}`,
                            title: item.title,
                            description: `${item.addr1 || ''} ${item.addr2 || ''}`.trim(),
                            location: item.addr1,
                            latitude: itemLat,
                            longitude: itemLng,
                            start_date: formatDate(item.eventstartdate),
                            end_date: formatDate(item.eventenddate),
                            image_url: item.firstimage || item.firstimage2 || null,
                            phone: item.tel,
                            distance_km: Math.round(dist * 10) / 10,
                            // 관광공사 링크 대신 네이버 검색 사용
                            detail_url: `https://search.naver.com/search.naver?query=${encodeURIComponent(item.title)}`,
                            source: 'tourapi'
                        });
                    }
                }
            });
        }

        // 2. 전국공연행사정보표준데이터 처리
        if (perfRes.status === 'fulfilled' && perfRes.value?.response?.body?.items) {
            const items = perfRes.value.response.body.items; // Array
            if (Array.isArray(items)) {
                items.forEach((item: any) => {
                    // 날짜 필터링 (종료일이 오늘 이후여야 함)
                    const end = item.eventEndDate ? getDateNumber(formatDate(item.eventEndDate)) : 0;
                    if (end >= todayNum) {
                        const itemLat = parseFloat(item.latitude);
                        const itemLng = parseFloat(item.longitude);
                        if (!isNaN(itemLat) && !isNaN(itemLng)) {
                            const dist = calculateDistance(lat, lng, itemLat, itemLng);
                            if (dist <= radiusKm) {
                                allEvents.push({
                                    id: `perf_${Math.random().toString(36).substr(2, 9)}`, // ID가 없으면 임의 생성
                                    title: item.eventNm,
                                    description: item.eventCo || item.opar || '',
                                    location: item.rdnmadr || item.lnmadr || '',
                                    latitude: itemLat,
                                    longitude: itemLng,
                                    start_date: formatDate(item.eventStartDate),
                                    end_date: formatDate(item.eventEndDate),
                                    image_url: null, // 공공데이터는 이미지 URL이 잘 없음
                                    phone: item.phoneNumber,
                                    distance_km: Math.round(dist * 10) / 10,
                                    detail_url: `https://search.naver.com/search.naver?query=${encodeURIComponent(item.eventNm)}`,
                                    source: 'performance'
                                });
                            }
                        }
                    }
                });
            }
        }

        // 3. 전국문화축제표준데이터 처리
        if (festRes.status === 'fulfilled' && festRes.value?.response?.body?.items) {
            const items = festRes.value.response.body.items;
            if (Array.isArray(items)) {
                items.forEach((item: any) => {
                    const end = item.fstvlEndDate ? getDateNumber(formatDate(item.fstvlEndDate)) : 0;
                    if (end >= todayNum) {
                        const itemLat = parseFloat(item.latitude);
                        const itemLng = parseFloat(item.longitude);
                        if (!isNaN(itemLat) && !isNaN(itemLng)) {
                            const dist = calculateDistance(lat, lng, itemLat, itemLng);
                            if (dist <= radiusKm) {
                                allEvents.push({
                                    id: `fest_${Math.random().toString(36).substr(2, 9)}`,
                                    title: item.fstvlNm,
                                    description: item.fstvlCo || item.opar || '',
                                    location: item.rdnmadr || item.lnmadr || '',
                                    latitude: itemLat,
                                    longitude: itemLng,
                                    start_date: formatDate(item.fstvlStartDate),
                                    end_date: formatDate(item.fstvlEndDate),
                                    image_url: null,
                                    phone: item.phoneNumber,
                                    distance_km: Math.round(dist * 10) / 10,
                                    detail_url: item.homepageUrl || `https://search.naver.com/search.naver?query=${encodeURIComponent(item.fstvlNm)}`,
                                    source: 'festival'
                                });
                            }
                        }
                    }
                });
            }
        }

        // 거리순 정렬
        allEvents.sort((a, b) => a.distance_km - b.distance_km);

        // 중복 제거 (거리와 제목이 매우 유사한 경우) - 간단히 ID 기준 중복은 없으므로 생략하거나 추후 고도화

        return NextResponse.json({
            success: true,
            source: 'combined',
            events: allEvents,
            totalCount: allEvents.length,
            debug: {
                tour: tourRes.status === 'rejected' ? String((tourRes as any).reason) : 'fulfilled',
                perf: perfRes.status === 'rejected' ? String((perfRes.reason as any)) : 'fulfilled',
                fest: festRes.status === 'rejected' ? String((festRes as any).reason) : 'fulfilled'
            }
        });

    } catch (error) {
        console.error('Nearby Events Error:', error);
        return NextResponse.json({
            success: false,
            source: 'error',
            events: [],
            message: '행사 정보를 불러올 수 없습니다.',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
