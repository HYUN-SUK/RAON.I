import { NextRequest, NextResponse } from 'next/server';

/**
 * 한국관광공사 TourAPI - 행사정보조회 (searchFestival1)
 * 사용자 위치 기반 반경 10km 내 행사/축제 정보 조회
 *
 * 환경변수: TOUR_API_KEY (공공데이터포털에서 발급)
 */

const TOUR_API_KEY = process.env.KMA_SERVICE_KEY; // 공공데이터포털 통합 인증키
const BASE_URL = 'https://apis.data.go.kr/B551011/KorService1';

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
        const radius = searchParams.get('radius') || '10000'; // 10km

        if (!TOUR_API_KEY) {
            // API 키 없으면 Fallback 데이터 반환
            return NextResponse.json({
                success: true,
                source: 'fallback',
                events: getFallbackEvents(),
            });
        }

        // TourAPI 행사정보조회 호출
        const apiUrl = new URL(`${BASE_URL}/searchFestival1`);
        apiUrl.searchParams.set('serviceKey', TOUR_API_KEY);
        apiUrl.searchParams.set('MobileOS', 'ETC');
        apiUrl.searchParams.set('MobileApp', 'RAONI');
        apiUrl.searchParams.set('_type', 'json');
        apiUrl.searchParams.set('numOfRows', '20');
        apiUrl.searchParams.set('pageNo', '1');
        apiUrl.searchParams.set('arrange', 'S'); // 거리순
        apiUrl.searchParams.set('mapX', lng);
        apiUrl.searchParams.set('mapY', lat);
        apiUrl.searchParams.set('radius', radius);

        // 현재 날짜를 기준으로 진행 중인 행사만 조회
        const today = new Date();
        const eventStartDate = formatDate(today);
        apiUrl.searchParams.set('eventStartDate', eventStartDate);

        const response = await fetch(apiUrl.toString(), {
            next: { revalidate: 21600 }, // 6시간 캐시
        });

        if (!response.ok) {
            throw new Error(`TourAPI 응답 오류: ${response.status}`);
        }

        const data: TourAPIResponse = await response.json();

        // 결과가 없을 경우 빈 배열 반환
        if (!data.response?.body?.items?.item) {
            return NextResponse.json({
                success: true,
                source: 'tourapi',
                events: [],
            });
        }

        // item이 단일 객체일 수도, 배열일 수도 있음
        const items = Array.isArray(data.response.body.items.item)
            ? data.response.body.items.item
            : [data.response.body.items.item];

        // 데이터 정규화
        const events = items.map((item) => ({
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
        }));

        return NextResponse.json({
            success: true,
            source: 'tourapi',
            events,
            totalCount: data.response.body.totalCount,
        });

    } catch (error) {
        console.error('TourAPI Error:', error);

        // 에러 시에도 Fallback 제공
        return NextResponse.json({
            success: true,
            source: 'fallback',
            events: getFallbackEvents(),
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

// Fallback 데이터 (API 키 없을 때)
function getFallbackEvents() {
    return [
        {
            id: 'fallback-1',
            title: '별빛 수목원 야간개장',
            description: '아침고요수목원에서 진행하는 야간 조명 축제',
            location: '가평군 상면 수목원로 432',
            latitude: 37.7410,
            longitude: 127.3456,
            start_date: '2026-01-01',
            end_date: '2026-03-31',
            image_url: null,
        },
        {
            id: 'fallback-2',
            title: '가평 겨울축제',
            description: '자라섬에서 열리는 겨울 문화축제',
            location: '가평군 가평읍 자라섬로 1',
            latitude: 37.8152,
            longitude: 127.5167,
            start_date: '2026-01-15',
            end_date: '2026-02-15',
            image_url: null,
        },
    ];
}
