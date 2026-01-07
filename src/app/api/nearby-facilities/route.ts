import { NextRequest, NextResponse } from 'next/server';

/**
 * 카카오맵 Local API - 주변 편의시설 검색
 * 사용자 위치 기반 반경 10km 내 편의시설 조회
 *
 * 환경변수: KAKAO_REST_API_KEY (Kakao Developers에서 발급)
 */

const KAKAO_API_KEY = process.env.KAKAO_REST_API_KEY;
const BASE_URL = 'https://dapi.kakao.com/v2/local/search/category.json';

// 카카오 카테고리 그룹 코드
const CATEGORY_CODES = {
    '마트': 'MT1',
    '편의점': 'CS2',
    '주유소': 'OL7',
    '약국': 'PM9',
    '병원': 'HP8',
};

interface KakaoPlace {
    id: string;
    place_name: string;
    category_group_name: string;
    phone: string;
    address_name: string;
    road_address_name: string;
    x: string;
    y: string;
    distance: string;
}

interface KakaoAPIResponse {
    meta: {
        total_count: number;
        pageable_count: number;
        is_end: boolean;
    };
    documents: KakaoPlace[];
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const lat = searchParams.get('lat') || '36.67'; // 기본값: 예산군 응봉면
        const lng = searchParams.get('lng') || '126.83';
        const radius = searchParams.get('radius') || '10000'; // 10km

        if (!KAKAO_API_KEY) {
            // API 키 없으면 Fallback 데이터 반환
            return NextResponse.json({
                success: true,
                source: 'fallback',
                facilities: getFallbackFacilities(),
            });
        }

        // 카테고리별 병렬 요청
        const categoryPromises = Object.entries(CATEGORY_CODES).map(
            async ([categoryName, code]) => {
                const apiUrl = new URL(BASE_URL);
                apiUrl.searchParams.set('category_group_code', code);
                apiUrl.searchParams.set('x', lng);
                apiUrl.searchParams.set('y', lat);
                apiUrl.searchParams.set('radius', radius);
                apiUrl.searchParams.set('sort', 'distance');
                apiUrl.searchParams.set('size', '5'); // 카테고리당 최대 5개

                const response = await fetch(apiUrl.toString(), {
                    headers: {
                        'Authorization': `KakaoAK ${KAKAO_API_KEY}`,
                    },
                    next: { revalidate: 3600 }, // 1시간 캐시
                });

                if (!response.ok) {
                    console.error(`Kakao API Error (${categoryName}):`, response.status);
                    return [];
                }

                const data: KakaoAPIResponse = await response.json();

                return data.documents.map((place) => ({
                    id: place.id,
                    category: categoryName,
                    name: place.place_name,
                    address: place.road_address_name || place.address_name,
                    phone: place.phone || null,
                    lat: parseFloat(place.y),
                    lng: parseFloat(place.x),
                    distance: `${(parseInt(place.distance) / 1000).toFixed(1)}km`,
                    distanceMeters: parseInt(place.distance),
                }));
            }
        );

        const results = await Promise.all(categoryPromises);

        // 모든 결과 합치고 거리순 정렬
        const allFacilities = results
            .flat()
            .sort((a, b) => a.distanceMeters - b.distanceMeters);

        return NextResponse.json({
            success: true,
            source: 'kakao',
            facilities: allFacilities,
            totalCount: allFacilities.length,
        });

    } catch (error) {
        console.error('Kakao API Error:', error);

        return NextResponse.json({
            success: true,
            source: 'fallback',
            facilities: getFallbackFacilities(),
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}

// Fallback 데이터 (API 키 없을 때)
function getFallbackFacilities() {
    return [
        {
            id: 'fallback-1',
            category: '마트',
            name: '하나로마트 가평점',
            address: '가평군 가평읍 읍내리 123',
            phone: '031-582-1234',
            lat: 37.8312,
            lng: 127.5098,
            distance: '3.2km',
        },
        {
            id: 'fallback-2',
            category: '주유소',
            name: 'SK에너지 가평주유소',
            address: '가평군 가평읍 읍내리 456',
            phone: '031-582-5678',
            lat: 37.8256,
            lng: 127.5123,
            distance: '2.8km',
        },
        {
            id: 'fallback-3',
            category: '약국',
            name: '온누리약국',
            address: '가평군 가평읍 읍내리 789',
            phone: '031-582-9012',
            lat: 37.8278,
            lng: 127.5087,
            distance: '3.0km',
        },
        {
            id: 'fallback-4',
            category: '병원',
            name: '가평의원',
            address: '가평군 가평읍 읍내리 101',
            phone: '031-582-3456',
            lat: 37.8290,
            lng: 127.5112,
            distance: '3.5km',
        },
        {
            id: 'fallback-5',
            category: '편의점',
            name: 'CU 가평역점',
            address: '가평군 가평읍 읍내리 202',
            phone: null,
            lat: 37.8234,
            lng: 127.5145,
            distance: '2.5km',
        },
    ];
}
