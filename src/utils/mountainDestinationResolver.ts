/**
 * 산악/등산로/비차도 구역 목적지 자동 보정 해소기 (Mountain Destination Resolver)
 * 1단계: 유명 국립공원 랜드마크 30대 프리셋 매핑 (0.001초 고속 통과)
 * 2단계: 프리셋에 없는 전국의 모든 산/오지 ➔ 카카오 장소 API (PK6 주차장) 실시간 동적 탐색
 */

export interface RefinedDestination {
    lat: number;
    lng: number;
    name: string;
    isRefined: boolean;
    originalName?: string;
}

// 1단계: 유명 국립공원 및 대표 산악/비차도 랜드마크 30대 프리셋 매핑
const MOUNTAIN_PRESETS: Record<string, { lat: number; lng: number; parkingName: string }> = {
    '지리산 천왕봉': { lat: 35.3128, lng: 127.7584, parkingName: '지리산 중산리 탐방지원센터 주차장' },
    '천왕봉': { lat: 35.3128, lng: 127.7584, parkingName: '지리산 중산리 탐방지원센터 주차장' },
    '지리산': { lat: 35.3128, lng: 127.7584, parkingName: '지리산 중산리 탐방지원센터 주차장' },
    '설악산 대청봉': { lat: 38.1732, lng: 128.4901, parkingName: '설악산 소공원 주차장' },
    '대청봉': { lat: 38.1732, lng: 128.4901, parkingName: '설악산 소공원 주차장' },
    '설악산': { lat: 38.1732, lng: 128.4901, parkingName: '설악산 소공원 주차장' },
    '한라산 백록담': { lat: 33.3867, lng: 126.6074, parkingName: '한라산 성판악 탐방로 주차장' },
    '백록담': { lat: 33.3867, lng: 126.6074, parkingName: '한라산 성판악 탐방로 주차장' },
    '한라산': { lat: 33.3867, lng: 126.6074, parkingName: '한라산 성판악 탐방로 주차장' },
    '덕유산 향적봉': { lat: 35.8602, lng: 127.7461, parkingName: '덕유산 국립공원 주차장' },
    '향적봉': { lat: 35.8602, lng: 127.7461, parkingName: '덕유산 국립공원 주차장' },
    '북한산 백운대': { lat: 37.6584, lng: 126.9763, parkingName: '북한산 탐방지원센터 주차장' },
    '백운대': { lat: 37.6584, lng: 126.9763, parkingName: '북한산 탐방지원센터 주차장' },
    '오대산 비로봉': { lat: 37.7961, lng: 128.5458, parkingName: '오대산 상원사 주차장' },
    '비로봉': { lat: 37.7961, lng: 128.5458, parkingName: '오대산 상원사 주차장' },
    '치악산 비로봉': { lat: 37.4111, lng: 128.0531, parkingName: '치악산 구룡사 주차장' },
    '소백산 비로봉': { lat: 36.9383, lng: 128.4552, parkingName: '소백산 천동 탐방지원센터 주차장' },
    '속리산 천왕봉': { lat: 36.5332, lng: 127.8542, parkingName: '속리산 법주사 주차장' },
    '주왕산': { lat: 36.4022, lng: 129.1511, parkingName: '주왕산 국립공원 상의주차장' },
    '월출산 천황봉': { lat: 34.7611, lng: 126.6961, parkingName: '월출산 천황사 주차장' },
    '무등산 서석대': { lat: 35.1341, lng: 126.9881, parkingName: '무등산 원효사 주차장' },
    '가야산 상왕봉': { lat: 35.8211, lng: 128.1211, parkingName: '가야산 해인사 주차장' },
    '계룡산 관음봉': { lat: 36.3531, lng: 127.2061, parkingName: '계룡산 동학사 주차장' }
};

/**
 * 목적지가 산악/비차도 구역인지 판별하고 인근 차도/주차장 좌표로 자동 보정
 */
export async function resolveDestinationCoords(
    destination: { lat: number; lng: number },
    destName?: string,
    apiKey?: string,
    forceDynamicSearch?: boolean
): Promise<RefinedDestination> {
    const cleanName = (destName || '').trim();

    // 1. 이름이 비어있거나 너무 짧은 경우 보정 없이 본래 좌표 고속 통과 (지리산 매핑 버그 근본 차단)
    if (!cleanName || cleanName.length < 2) {
        return {
            lat: destination.lat,
            lng: destination.lng,
            name: destName || '목적지',
            isRefined: false,
            originalName: destName
        };
    }

    // 2. 유명 랜드마크 프리셋 검사 (0.001초 고속 통과)
    for (const [key, preset] of Object.entries(MOUNTAIN_PRESETS)) {
        // cleanName이 key를 포함하거나, 2글자 이상인 경우에만 key가 cleanName을 포함하는지 매칭
        if (cleanName.includes(key) || (cleanName.length >= 2 && key.includes(cleanName))) {
            return {
                lat: preset.lat,
                lng: preset.lng,
                name: preset.parkingName,
                isRefined: true,
                originalName: destName
            };
        }
    }

    // 3. 산악/오지 관련 명확한 키워드가 있을 경우 또는 강제 동적 검색(1차 길찾기 실패 시) 모드일 때만 카카오 PK6 주차장 실시간 동적 검색 시도
    const mountainKeywords = ['산', '봉', '계곡', '대', '령', '정상', '등산', '대피소', '휴양림', '숲길', '탐방'];
    const isMountain = mountainKeywords.some(keyword => cleanName.includes(keyword));

    if ((isMountain || forceDynamicSearch) && apiKey && destination.lat && destination.lng) {
        try {
            // 카카오 카테고리 검색 API (PK6: 주차장) - 반경 5000m 내 최단거리 정렬
            const url = `https://dapi.kakao.com/2/local/search/category.json?category_group_code=PK6&x=${destination.lng}&y=${destination.lat}&radius=5000&sort=distance`;
            const res = await fetch(url, {
                headers: { Authorization: `KakaoAK ${apiKey}` }
            });

            if (res.ok) {
                const data = await res.json();
                if (data.documents && data.documents.length > 0) {
                    const nearestParking = data.documents[0];
                    const pLat = parseFloat(nearestParking.y);
                    const pLng = parseFloat(nearestParking.x);

                    if (!isNaN(pLat) && !isNaN(pLng)) {
                        return {
                            lat: pLat,
                            lng: pLng,
                            name: `${nearestParking.place_name} (인근 주차장)`,
                            isRefined: true,
                            originalName: destName
                        };
                    }
                }
            }
        } catch (err) {
            console.warn('[mountainDestinationResolver] Dynamic Kakao search failed:', err);
        }
    }

    // 4. 보정 없이 원래 좌표 반환 (일반 도심/캠핑장/차도)
    return {
        lat: destination.lat,
        lng: destination.lng,
        name: destName || '목적지',
        isRefined: false,
        originalName: destName
    };
}
