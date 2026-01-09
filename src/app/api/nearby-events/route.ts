import { NextRequest, NextResponse } from 'next/server';

/**
 * 한국관광공사 TourAPI - 행사정보조회 (searchFestival1)
 * 사용자 위치 기반 반경 30km 내 행사/축제 정보 조회
 *
 * 환경변수: TOUR_API_KEY (공공데이터포털에서 발급)
 */

const TOUR_API_KEY = process.env.TOUR_API_KEY; // TourAPI 전용 인증키
// 한국관광공사_국문 관광정보 서비스_GW 엔드포인트 (KorService2)
const BASE_URL = 'https://apis.data.go.kr/B551011/KorService2';

interface TourAPIEvent {
    contentid: string;
    title: string;
    addr1: string;
    addr2?: string;
    eventstartdate: string;
    eventenddate: string;
    firstimage?: string;
    firstimage2?: string;
    mapx: string;
    mapy: string;
    tel?: string;
}

interface TourAPIResponse {
    response: {
        header: {
            resultCode: string;
            resultMsg: string;
        };
        body: {
            items: {
                item: TourAPIEvent | TourAPIEvent[];
            };
            numOfRows: number;
            pageNo: number;
            totalCount: number;
        };
    };
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const lat = searchParams.get('lat') || '36.67'; // 기본값: 예산군 응봉면
        const lng = searchParams.get('lng') || '126.83';
        const radius = searchParams.get('radius') || '30000'; // 30km (농촌 지역 특성 반영)

        if (!TOUR_API_KEY) {
            // API 키 없으면 빈 배열 + 안내 메시지 반환 (가짜 데이터 노출 금지)
            console.warn('[TourAPI] API 키가 설정되지 않았습니다.');
            return NextResponse.json({
                success: true,
                source: 'no_api_key',
                events: [],
                message: '현재 진행중인 행사 정보를 불러올 수 없습니다.',
            });
        }

        // TourAPI 행사정보조회 (searchFestival2)
        // KorService2 GW 버전 공식 API - 날짜 정보(eventstartdate, eventenddate) 포함
        // eventStartDate: 오늘 날짜 이후 시작/진행 중인 행사 조회
        const today = new Date();
        const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

        // 충청남도(areaCode=34) 지역 행사 검색
        // 전국 검색 시 areaCode 제거 가능
        const apiUrl = `${BASE_URL}/searchFestival2?serviceKey=${TOUR_API_KEY}&MobileOS=ETC&MobileApp=RAONI&_type=json&numOfRows=50&pageNo=1&arrange=S&eventStartDate=${todayStr}`;

        // DEBUG: API 호출 로그 (키 마스킹)
        console.log(`[TourAPI Request] ${apiUrl.replace(TOUR_API_KEY || '', '***MASKED***')}`);

        const response = await fetch(apiUrl, {
            next: { revalidate: 0 }, // 디버깅을 위해 캐시 끔
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[TourAPI Error] Status: ${response.status}, Body: ${errorText}`);
            throw new Error(`TourAPI 응답 오류: ${response.status}`);
        }

        const data: TourAPIResponse = await response.json();

        // DEBUG: 응답 확인
        // console.log('[TourAPI Response]', JSON.stringify(data).slice(0, 200));

        // 결과가 없을 경우 빈 배열 반환
        if (!data.response?.body?.items) {
            console.warn('[TourAPI Warning] No items found or invalid structure:', JSON.stringify(data));
            // API는 성공했지만 데이터가 없는 경우 -> Fallback 대신 빈 배열 반환 (사용자가 혼동 없게)
            // 또는 정말 오류인 경우에만 Fallback
            if (data.response?.header?.resultCode !== '0000') {
                console.error(`[TourAPI Fail] Code: ${data.response?.header?.resultCode}, Msg: ${data.response?.header?.resultMsg}`);
                throw new Error(data.response?.header?.resultMsg);
            }

            return NextResponse.json({
                success: true,
                source: 'tourapi',
                events: [],
                totalCount: 0,
            });
        }

        // item이 단일 객체일 수도, 배열일 수도 있음
        // item이 undefined인 경우(결과 0개)도 체크
        const rawItems = data.response.body.items.item;
        if (!rawItems) {
            return NextResponse.json({
                success: true,
                source: 'tourapi',
                events: [],
                totalCount: data.response.body.totalCount,
            });
        }

        const items = Array.isArray(rawItems) ? rawItems : [rawItems];

        // Haversine 공식으로 두 좌표 사이의 거리 계산 (km)
        const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
            const R = 6371; // 지구 반지름 (km)
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };

        const userLat = parseFloat(lat);
        const userLng = parseFloat(lng);
        const radiusKm = parseInt(radius) / 1000; // m → km 변환

        // 1단계: 종료일 기준 필터링 (종료일이 오늘 이상인 행사만)
        const ongoingItems = items.filter((item) => {
            const endDate = item.eventenddate || '';
            const todayFilter = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
            return !endDate || endDate >= todayFilter;
        });

        // 2단계: 거리 기준 필터링 (30km 이내 행사만)
        const nearbyItems = ongoingItems.filter((item) => {
            const eventLat = parseFloat(item.mapy);
            const eventLng = parseFloat(item.mapx);
            if (isNaN(eventLat) || isNaN(eventLng)) return false;
            const distance = calculateDistance(userLat, userLng, eventLat, eventLng);
            return distance <= radiusKm;
        }).map((item) => {
            // 거리 정보 추가
            const eventLat = parseFloat(item.mapy);
            const eventLng = parseFloat(item.mapx);
            const distance = calculateDistance(userLat, userLng, eventLat, eventLng);
            return { ...item, distance };
        }).sort((a, b) => a.distance - b.distance); // 가까운 순 정렬

        // 데이터 정규화 (거리 필터링된 항목 사용)
        const events = nearbyItems.map((item) => ({
            id: item.contentid,
            title: item.title,
            description: `${item.addr1 || ''} ${item.addr2 || ''}`.trim(),
            location: item.addr1,
            latitude: parseFloat(item.mapy),
            longitude: parseFloat(item.mapx),
            start_date: formatDisplayDate(item.eventstartdate),
            end_date: formatDisplayDate(item.eventenddate),
            image_url: item.firstimage || item.firstimage2 || null,
            phone: item.tel,
            distance_km: Math.round(item.distance * 10) / 10, // 소수점 1자리
            // 한국관광공사 상세 페이지 URL
            detail_url: `https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=${item.contentid}`,
        }));

        return NextResponse.json({
            success: true,
            source: 'tourapi',
            events,
            totalCount: events.length, // 필터링 후 개수
            originalCount: data.response.body.totalCount, // 원본 개수
        });

    } catch (error) {
        console.error('TourAPI Error:', error);

        // 에러 시 빈 배열 + 안내 메시지 반환 (가짜 데이터 노출 금지)
        return NextResponse.json({
            success: false,
            source: 'error',
            events: [],
            message: '현재 진행중인 행사 정보를 불러올 수 없습니다.',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}

// 날짜 포맷 (YYYYMMDD)
function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

// 디스플레이용 날짜 포맷 (YYYY-MM-DD)
function formatDisplayDate(dateStr: string): string {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
}

// NOTE: Fallback 데이터 완전 제거 (SSOT v9: 가짜 정보 노출 금지 원칙)
// 행사 정보가 없을 경우 "현재 진행중인 행사가 없습니다" 메시지로 안내
