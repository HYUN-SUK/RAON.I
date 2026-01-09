import { NextRequest, NextResponse } from 'next/server';

/**
 * 한국관광공사 TourAPI - 위치기반 관광정보 조회
 * 레포츠(28), 관광지(12), 문화시설(14) 등 조회
 * 
 * 환경변수: TOUR_API_KEY (공공데이터포털에서 발급)
 */

const TOUR_API_KEY = process.env.TOUR_API_KEY;
const BASE_URL = 'https://apis.data.go.kr/B551011/KorService2';

// contentTypeId 매핑
const CONTENT_TYPES: Record<string, { id: string; label: string }> = {
    leisure: { id: '28', label: '레포츠' },      // 캠핑, 낚시, 래프팅 등
    attraction: { id: '12', label: '관광지' },  // 명소, 체험장, 자연경관
    culture: { id: '14', label: '문화시설' },   // 박물관, 전시관, 공연장
};

interface TourAPIItem {
    contentid: string;
    title: string;
    addr1: string;
    addr2?: string;
    firstimage?: string;
    firstimage2?: string;
    mapx: string;
    mapy: string;
    tel?: string;
    cat1?: string;
    cat2?: string;
    cat3?: string;
}

interface TourAPIResponse {
    response: {
        header: {
            resultCode: string;
            resultMsg: string;
        };
        body: {
            items: {
                item: TourAPIItem | TourAPIItem[];
            };
            numOfRows: number;
            pageNo: number;
            totalCount: number;
        };
    };
}

// Haversine 공식으로 두 좌표 사이의 거리 계산 (km)
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

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const lat = searchParams.get('lat') || '36.67';
        const lng = searchParams.get('lng') || '126.83';
        const radius = searchParams.get('radius') || '30000';
        const type = searchParams.get('type') || 'leisure'; // leisure, attraction, culture

        if (!TOUR_API_KEY) {
            console.warn('[TourAPI Activities] API 키가 설정되지 않았습니다.');
            return NextResponse.json({
                success: true,
                source: 'no_api_key',
                items: [],
                message: '관광 정보를 불러올 수 없습니다.',
            });
        }

        const contentType = CONTENT_TYPES[type] || CONTENT_TYPES.leisure;
        const radiusKm = parseInt(radius) / 1000;

        // TourAPI 위치기반 관광정보 조회 (locationBasedList2)
        const apiUrl = `${BASE_URL}/locationBasedList2?serviceKey=${TOUR_API_KEY}&MobileOS=ETC&MobileApp=RAONI&_type=json&numOfRows=50&pageNo=1&arrange=E&mapX=${lng}&mapY=${lat}&radius=${radius}&contentTypeId=${contentType.id}`;

        const response = await fetch(apiUrl, {
            next: { revalidate: 3600 }, // 1시간 캐시
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[TourAPI Activities Error] Status: ${response.status}, Body: ${errorText}`);
            throw new Error(`TourAPI 응답 오류: ${response.status}`);
        }

        const data: TourAPIResponse = await response.json();

        // 결과 없음
        if (!data.response?.body?.items?.item) {
            return NextResponse.json({
                success: true,
                source: 'tourapi',
                type: type,
                typeLabel: contentType.label,
                items: [],
                totalCount: 0,
            });
        }

        const rawItems = data.response.body.items.item;
        const items = Array.isArray(rawItems) ? rawItems : [rawItems];

        const userLat = parseFloat(lat);
        const userLng = parseFloat(lng);

        // 거리 계산 및 정렬 + 필터링
        const processedItems = items
            .map((item) => {
                const itemLat = parseFloat(item.mapy);
                const itemLng = parseFloat(item.mapx);
                const distance = calculateDistance(userLat, userLng, itemLat, itemLng);
                return {
                    id: item.contentid,
                    title: item.title,
                    description: `${item.addr1 || ''} ${item.addr2 || ''}`.trim(),
                    location: item.addr1,
                    latitude: itemLat,
                    longitude: itemLng,
                    image_url: item.firstimage || item.firstimage2 || null,
                    phone: item.tel,
                    distance_km: Math.round(distance * 10) / 10,
                    // 관광공사 ID 체계 변경으로 인해 직접 링크 대신 네이버 검색으로 연결 (더 정확함)
                    detail_url: `https://search.naver.com/search.naver?query=${encodeURIComponent(item.title)}`,
                    category: contentType.label,
                };
            })
            // 거리 필터링 + 레포츠인 경우 캠핑장 제외 필터링
            .filter((item) => {
                const isWithinRange = item.distance_km <= radiusKm;

                // 레포츠(leisure)인 경우 캠핑 관련 키워드 제외
                if (type === 'leisure') {
                    const excludeKeywords = ['캠핑', '야영', '글램핑', '카라반', '오토캠핑', '캠프'];
                    const hasKeyword = excludeKeywords.some(keyword => item.title.includes(keyword));
                    return isWithinRange && !hasKeyword;
                }

                return isWithinRange;
            })
            .sort((a, b) => a.distance_km - b.distance_km);

        return NextResponse.json({
            success: true,
            source: 'tourapi',
            type: type,
            typeLabel: contentType.label,
            items: processedItems,
            totalCount: processedItems.length,
            originalCount: data.response.body.totalCount,
        });

    } catch (error) {
        console.error('TourAPI Activities Error:', error);
        return NextResponse.json({
            success: false,
            source: 'error',
            items: [],
            message: '관광 정보를 불러올 수 없습니다.',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
