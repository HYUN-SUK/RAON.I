import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-client';

/**
 * 주변 행사 통합 API (Hybrid Caching Strategy)
 * 
 * 1. Nationwide Prefetch (전국 데이터 중앙 캐싱)
 *    - 매일 1회(또는 만료 시) 전국 축제/행사 데이터를 서버에서 조회
 *    - DB 'nearby_cache' 테이블에 'ALL' + 'YYYYMMDD' 키로 저장
 *    - 유저 요청 시 외부 API 호출 없이 DB에서 꺼내 메모리 필터링 (거리 계산)
 * 
 * 2. Source
 *    - 한국관광공사 TourAPI (searchFestival2)
 *    - (Optional) 공공데이터포털 표준데이터 (보완용)
 */

const TOUR_API_KEY = process.env.TOUR_API_KEY || '03e41a022f4e6033f803beff860f41460f071cc9482e2532db99c142505f9df2';

// 24 Hours Cache TTL
const CACHE_TTL_SECONDS = 24 * 60 * 60;

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
    distance_km?: number; // Calculated dynamically
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

function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const cleanStr = dateStr.replace(/-/g, '');
    if (cleanStr.length === 8) {
        return `${cleanStr.substring(0, 4)}.${cleanStr.substring(4, 6)}.${cleanStr.substring(6, 8)}`;
    }
    return dateStr;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const lat = parseFloat(searchParams.get('lat') || '36.67');
        const lng = parseFloat(searchParams.get('lng') || '126.83');
        const radius = parseFloat(searchParams.get('radius') || '30000');
        const radiusKm = radius / 1000;

        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayStr = `${year}${month}${day}`;
        // Base Date for Cache Key (Daily Cache)
        const baseDate = todayStr;

        if (!TOUR_API_KEY) {
            return NextResponse.json({ success: true, source: 'no_api_key', events: [], message: 'API 키가 설정되지 않았습니다.' });
        }

        const supabase = createClient();

        // 1. Check DB Cache (nearby_cache)
        // Key: region_code = 'ALL', base_date = todayStr
        const { data: cacheHit, error: cacheError } = await supabase
            .from('nearby_cache')
            .select('*')
            .eq('region_code', 'ALL')
            .eq('base_date', baseDate)
            .single();

        let allEvents: NormalizedEvent[] = [];
        let source = 'db_cache';

        if (cacheHit && !cacheError && cacheHit.data) {
            // Cache HIT
            // Supabase JSONB returns plain object, need cast
            const cachedData = cacheHit.data; // any type
            if (Array.isArray(cachedData)) {
                allEvents = cachedData as NormalizedEvent[];
            }
            // console.log(`[Nearby] Cache HIT: ${allEvents.length} events loaded from DB.`);
        } else {
            // Cache MISS - Fetch Nationwide Data
            source = 'api_renewed';
            // console.log(`[Nearby] Cache MISS: Fetching nationwide data from TourAPI...`);

            // Fetch Strategy:
            // TourAPI searchFestival2 without areaCode returns ALL festivals.
            // Limit to 2000 to cover everything (normally ~1000 active)
            const apiUrl = `https://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${TOUR_API_KEY}&MobileOS=ETC&MobileApp=RAONI&_type=json&numOfRows=2000&arrange=A&eventStartDate=${todayStr}`;

            try {
                // No need for next: { revalidate: 3600 } since we control cache via DB
                const res = await fetch(apiUrl);
                if (!res.ok) throw new Error(`API Error: ${res.status}`);
                const text = await res.text();
                let json;
                try {
                    json = JSON.parse(text);
                } catch (e) {
                    throw new Error(`JSON Parse Error: ${text.substring(0, 100)}`);
                }

                const items = json?.response?.body?.items?.item;
                const itemList = Array.isArray(items) ? items : (items ? [items] : []);

                allEvents = itemList.map((item: any) => ({
                    id: `tour_${item.contentid}`,
                    title: item.title,
                    description: `${item.addr1 || ''} ${item.addr2 || ''}`.trim(),
                    location: item.addr1,
                    latitude: parseFloat(item.mapy),
                    longitude: parseFloat(item.mapx),
                    start_date: formatDate(item.eventstartdate),
                    end_date: formatDate(item.eventenddate),
                    image_url: item.firstimage || item.firstimage2 || null,
                    phone: item.tel,
                    detail_url: `https://search.naver.com/search.naver?query=${encodeURIComponent(item.title)}`,
                    source: 'tourapi' as const
                })).filter((e: NormalizedEvent) => !isNaN(e.latitude) && !isNaN(e.longitude));

                // Save to DB (Upsert)
                // Note: region_code 'ALL'
                const { error: upsertError } = await supabase
                    .from('nearby_cache')
                    .upsert({
                        region_code: 'ALL',
                        base_date: baseDate,
                        data: allEvents,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'region_code, base_date' });

                if (upsertError) {
                    console.error('[Nearby] DB Upsert Error:', upsertError);
                    // Fallback: Just return data, don't crash
                }

            } catch (e) {
                console.error('[Nearby] API Fetch Failed:', e);
                // Return empty if completely failed
                return NextResponse.json({ success: false, message: 'Failed to fetch nationwide data' });
            }
        }

        // 2. In-Memory Filtering (Geo-Spatial)
        // Filter by Radius
        const filteredEvents = allEvents
            .map(event => {
                const dist = calculateDistance(lat, lng, event.latitude, event.longitude);
                return { ...event, distance_km: Math.round(dist * 10) / 10 };
            })
            .filter(event => {
                if (event.distance_km > radiusKm) return false;
                
                // 날짜 필터링: 현재 날짜가 행사 기간과 겹치는지 검사
                const startClean = event.start_date ? event.start_date.replace(/\./g, '') : '';
                const endClean = event.end_date ? event.end_date.replace(/\./g, '') : '';
                
                if (startClean && endClean) {
                    return startClean <= todayStr && todayStr <= endClean;
                }
                return true;
            })
            .sort((a, b) => a.distance_km - b.distance_km);

        return NextResponse.json({
            success: true,
            source,
            events: filteredEvents,
            totalCount: filteredEvents.length,
            cachedTotal: allEvents.length
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
