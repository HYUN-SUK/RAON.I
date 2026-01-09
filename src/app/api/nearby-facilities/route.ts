import { NextRequest, NextResponse } from 'next/server';

/**
 * 카카오맵 Local API - 주변 편의시설 검색
 * 사용자 위치 기반 반경 30km 내 편의시설 조회
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
        const radius = searchParams.get('radius') || '30000'; // 30km (농촌 지역 특성 반영)

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
                // 카카오맵 API 최대 반경: 20,000m (20km)
                const kakaoRadius = Math.min(parseInt(radius), 20000).toString();
                apiUrl.searchParams.set('radius', kakaoRadius);
                apiUrl.searchParams.set('sort', 'distance');
                apiUrl.searchParams.set('size', '5'); // 카테고리당 최대 5개

                const response = await fetch(apiUrl.toString(), {
                    headers: {
                        'Authorization': `KakaoAK ${KAKAO_API_KEY}`,
                    },
                    next: { revalidate: 3600 }, // 1시간 캐시
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`Kakao API Error (${categoryName}): ${response.status}, Body: ${errorText}`);
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

        // 결과가 없으면 Fallback 사용
        if (allFacilities.length === 0) {
            return NextResponse.json({
                success: true,
                source: 'fallback',
                facilities: getFallbackFacilities(),
                message: 'No facilities found in area, using fallback data',
            });
        }

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

// Fallback 데이터 (API 키 없거나 결과 없을 때) - 예산군 응봉면 기준
function getFallbackFacilities() {
    return [
        {
            id: 'fallback-1',
            category: '마트',
            name: '하나로마트 예산점',
            address: '충남 예산군 예산읍 예산로 203',
            phone: '041-333-1234',
            lat: 36.6830,
            lng: 126.8444,
            distance: '2.5km',
        },
        {
            id: 'fallback-2',
            category: '주유소',
            name: 'SK에너지 응봉주유소',
            address: '충남 예산군 응봉면 응봉서로 150',
            phone: '041-333-5678',
            lat: 36.6750,
            lng: 126.8350,
            distance: '1.2km',
        },
        {
            id: 'fallback-3',
            category: '약국',
            name: '예산온누리약국',
            address: '충남 예산군 예산읍 예산로 185',
            phone: '041-333-9012',
            lat: 36.6825,
            lng: 126.8420,
            distance: '2.3km',
        },
        {
            id: 'fallback-4',
            category: '병원',
            name: '예산의원',
            address: '충남 예산군 예산읍 역전로 45',
            phone: '041-333-3456',
            lat: 36.6800,
            lng: 126.8400,
            distance: '2.0km',
        },
        {
            id: 'fallback-5',
            category: '편의점',
            name: 'CU 응봉점',
            address: '충남 예산군 응봉면 응봉로 80',
            phone: null,
            lat: 36.6700,
            lng: 126.8300,
            distance: '0.8km',
        },
    ];
}
