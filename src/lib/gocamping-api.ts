/**
 * 고캠핑 API 연동 모듈
 * https://www.gocamping.or.kr
 *
 * 공공데이터포털에서 제공하는 캠핑장 목록 API
 */

// ═══════════════════════════════════════════════════════════
// 타입 정의
// ═══════════════════════════════════════════════════════════

/** 고캠핑 API 응답 구조 */
export interface GoCampingResponse {
    response: {
        header: {
            resultCode: string;
            resultMsg: string;
        };
        body: {
            items: {
                item: GoCampingItem[];
            };
            numOfRows: number;
            pageNo: number;
            totalCount: number;
        };
    };
}

/** 고캠핑 캠핑장 아이템 */
export interface GoCampingItem {
    contentId: string;           // 콘텐츠 ID
    facltNm: string;             // 캠핑장 이름
    lineIntro?: string;          // 한줄 소개
    intro?: string;              // 상세 소개
    allar?: string;              // 전체 면적
    insrncAt?: string;           // 영업 보험 가입 여부
    trsagntNo?: string;          // 여행사업자 번호
    bizrno?: string;             // 사업자등록번호
    facltDivNm?: string;         // 캠핑장 유형 (일반야영장, 자동차야영장 등)
    mangeDivNm?: string;         // 운영 주체 (민간/지자체)
    mgcDiv?: string;             // 관리주체 구분 (민간/지자체)
    manageSttus?: string;        // 운영상태 (운영, 휴장 등)
    hvofBgnde?: string;          // 휴장 시작일
    hvofEndde?: string;          // 휴장 종료일
    featureNm?: string;          // 특징
    induty?: string;             // 업종 (일반야영장,자동차야영장,글램핑,카라반)
    lctCl?: string;              // 입지 구분 (해변, 섬, 산, 숲, 계곡, 강, 호수, 도심)
    doNm?: string;               // 도
    sigunguNm?: string;          // 시군구
    zipcode?: string;            // 우편번호
    addr1: string;               // 주소
    addr2?: string;              // 상세주소
    mapX: string;                // 경도 (longitude)
    mapY: string;                // 위도 (latitude)
    direction?: string;          // 오시는 길
    tel?: string;                // 전화번호
    homepage?: string;           // 홈페이지
    resveUrl?: string;           // 예약 URL
    resveCl?: string;            // 예약 구분 (온라인예약, 전화예약 등)
    posblFcltyCl?: string;       // 주변 이용가능 시설
    posblFcltyEtc?: string;      // 주변 기타 시설
    clturEventAt?: string;       // 자체 문화행사 여부
    clturEvent?: string;         // 자체 문화행사명
    exprnProgrmAt?: string;      // 체험 프로그램 여부
    exprnProgrm?: string;        // 체험 프로그램명
    extshrCo?: number;           // 소화기 개수
    frprvtWrppCo?: number;       // 방화수 개수
    frprvtSandCo?: number;       // 방화사 개수
    fireSensorCo?: number;       // 화재감지기 개수
    themaEnvrnCl?: string;       // 테마 환경 (일출명소, 일몰명소, 수상레저 등)
    eqpmnLendCl?: string;        // 캠핑장비 대여 목록
    animalCmgCl?: string;        // 애완동물 출입 (가능/불가능/가능(소형견))
    tourEraCl?: string;          // 여행시기
    firstImageUrl?: string;      // 대표 이미지
    createdtime?: string;        // 등록일
    modifiedtime?: string;       // 수정일
    // 부대시설
    sbrsCl?: string;             // 부대시설 (전기,무선인터넷,장작판매,온수,...)
    sbrsEtc?: string;            // 부대시설 기타
    toiletCo?: number;           // 화장실 개수
    swrmCo?: number;             // 샤워실 개수
    wtrplCo?: number;            // 개수대 개수
    brazierCl?: string;          // 화로대 (개별/불가)
    siteBottomCl1?: number;      // 잔디 사이트 수
    siteBottomCl2?: number;      // 파쇄석 사이트 수
    siteBottomCl3?: number;      // 테크 사이트 수
    siteBottomCl4?: number;      // 자갈 사이트 수
    siteBottomCl5?: number;      // 맨흙 사이트 수
    siteMg1Co?: number;          // 사이트 크기 1 개수
    siteMg2Co?: number;          // 사이트 크기 2 개수
    siteMg3Co?: number;          // 사이트 크기 3 개수
    siteMg1Width?: number;       // 사이트 크기 1 가로
    siteMg1Vrticl?: number;      // 사이트 크기 1 세로
    siteMg2Width?: number;       // 사이트 크기 2 가로
    siteMg2Vrticl?: number;      // 사이트 크기 2 세로
    siteMg3Width?: number;       // 사이트 크기 3 가로
    siteMg3Vrticl?: number;      // 사이트 크기 3 세로
    // 글램핑/카라반 관련
    gnrlSiteCo?: number;         // 일반 사이트 수
    autoSiteCo?: number;         // 자동차 사이트 수
    glampSiteCo?: number;        // 글램핑 사이트 수
    caravSiteCo?: number;        // 카라반 사이트 수
    indvdlCaravSiteCo?: number;  // 개인 카라반 사이트 수
    glampInnerFclty?: string;    // 글램핑 내부시설
    caravInnerFclty?: string;    // 카라반 내부시설
    // 운영일
    operPdCl?: string;           // 운영기간 구분 (연중개방, 계절운영)
    operDeCl?: string;           // 운영일 구분 (평일+주말)
}

// ═══════════════════════════════════════════════════════════
// API 호출 함수
// ═══════════════════════════════════════════════════════════

const GOCAMPING_BASE_URL = 'http://apis.data.go.kr/B551011/GoCamping';

interface FetchCampgroundsOptions {
    pageNo?: number;
    numOfRows?: number;
    keyword?: string;
    doNm?: string;        // 도 이름 (예: 충청남도)
    sigunguNm?: string;   // 시군구 이름 (예: 예산군)
}

/**
 * 캠핑장 목록 조회 (기본 조회)
 */
export async function fetchCampgrounds(
    options: FetchCampgroundsOptions = {}
): Promise<GoCampingItem[]> {
    const apiKey = process.env.GOCAMPING_API_KEY;
    if (!apiKey) {
        throw new Error('GOCAMPING_API_KEY 환경변수가 설정되지 않았습니다.');
    }

    const {
        pageNo = 1,
        numOfRows = 100,
    } = options;

    const params = new URLSearchParams({
        serviceKey: apiKey,
        MobileOS: 'ETC',
        MobileApp: 'RAONI',
        _type: 'json',
        pageNo: pageNo.toString(),
        numOfRows: numOfRows.toString(),
    });

    const url = `${GOCAMPING_BASE_URL}/basedList?${params.toString()}`;

    try {
        const response = await fetch(url, {
            next: { revalidate: 86400 }, // 24시간 캐시
        });

        if (!response.ok) {
            throw new Error(`고캠핑 API 오류: ${response.status}`);
        }

        const data: GoCampingResponse = await response.json();

        if (data.response.header.resultCode !== '0000') {
            throw new Error(`고캠핑 API 오류: ${data.response.header.resultMsg}`);
        }

        const items = data.response.body.items?.item || [];
        return Array.isArray(items) ? items : [items];
    } catch (error) {
        console.error('[GoCamping] 데이터 조회 실패:', error);
        throw error;
    }
}

/**
 * 키워드로 캠핑장 검색
 */
export async function searchCampgrounds(
    keyword: string,
    options: Omit<FetchCampgroundsOptions, 'keyword'> = {}
): Promise<GoCampingItem[]> {
    const apiKey = process.env.GOCAMPING_API_KEY;
    if (!apiKey) {
        throw new Error('GOCAMPING_API_KEY 환경변수가 설정되지 않았습니다.');
    }

    const { pageNo = 1, numOfRows = 50 } = options;

    const params = new URLSearchParams({
        serviceKey: apiKey,
        MobileOS: 'ETC',
        MobileApp: 'RAONI',
        _type: 'json',
        pageNo: pageNo.toString(),
        numOfRows: numOfRows.toString(),
        keyword: encodeURIComponent(keyword),
    });

    const url = `${GOCAMPING_BASE_URL}/searchList?${params.toString()}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`고캠핑 API 오류: ${response.status}`);
        }

        const data: GoCampingResponse = await response.json();

        if (data.response.header.resultCode !== '0000') {
            throw new Error(`고캠핑 API 오류: ${data.response.header.resultMsg}`);
        }

        const items = data.response.body.items?.item || [];
        return Array.isArray(items) ? items : [items];
    } catch (error) {
        console.error('[GoCamping] 검색 실패:', error);
        throw error;
    }
}

/**
 * 지역별 캠핑장 조회
 */
export async function fetchCampgroundsByRegion(
    doNm: string,
    sigunguNm?: string,
    options: Omit<FetchCampgroundsOptions, 'doNm' | 'sigunguNm'> = {}
): Promise<GoCampingItem[]> {
    const apiKey = process.env.GOCAMPING_API_KEY;
    if (!apiKey) {
        throw new Error('GOCAMPING_API_KEY 환경변수가 설정되지 않았습니다.');
    }

    const { pageNo = 1, numOfRows = 100 } = options;

    const params = new URLSearchParams({
        serviceKey: apiKey,
        MobileOS: 'ETC',
        MobileApp: 'RAONI',
        _type: 'json',
        pageNo: pageNo.toString(),
        numOfRows: numOfRows.toString(),
    });

    const url = `${GOCAMPING_BASE_URL}/locationBasedList?${params.toString()}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`고캠핑 API 오류: ${response.status}`);
        }

        const data: GoCampingResponse = await response.json();

        if (data.response.header.resultCode !== '0000') {
            throw new Error(`고캠핑 API 오류: ${data.response.header.resultMsg}`);
        }

        const items = data.response.body.items?.item || [];
        const allItems = Array.isArray(items) ? items : [items];

        // 지역 필터링 (API가 지역 파라미터를 지원하지 않으면 클라이언트에서 필터)
        return allItems.filter((item) => {
            const matchDo = !doNm || item.doNm === doNm;
            const matchSigungu = !sigunguNm || item.sigunguNm === sigunguNm;
            return matchDo && matchSigungu;
        });
    } catch (error) {
        console.error('[GoCamping] 지역 조회 실패:', error);
        throw error;
    }
}

/**
 * 전체 캠핑장 수 조회
 */
export async function getTotalCampgroundCount(): Promise<number> {
    const apiKey = process.env.GOCAMPING_API_KEY;
    if (!apiKey) {
        throw new Error('GOCAMPING_API_KEY 환경변수가 설정되지 않았습니다.');
    }

    const params = new URLSearchParams({
        serviceKey: apiKey,
        MobileOS: 'ETC',
        MobileApp: 'RAONI',
        _type: 'json',
        pageNo: '1',
        numOfRows: '1',
    });

    const url = `${GOCAMPING_BASE_URL}/basedList?${params.toString()}`;

    try {
        const response = await fetch(url);
        const data: GoCampingResponse = await response.json();

        if (data.response.header.resultCode !== '0000') {
            throw new Error(`고캠핑 API 오류: ${data.response.header.resultMsg}`);
        }

        return data.response.body.totalCount || 0;
    } catch (error) {
        console.error('[GoCamping] 전체 개수 조회 실패:', error);
        throw error;
    }
}

/**
 * 전체 캠핑장 데이터 일괄 조회 (페이지네이션 자동 처리)
 */
export async function fetchAllCampgrounds(
    onProgress?: (current: number, total: number) => void
): Promise<GoCampingItem[]> {
    const totalCount = await getTotalCampgroundCount();
    const numOfRows = 500; // 한 번에 500개씩
    const totalPages = Math.ceil(totalCount / numOfRows);

    const allItems: GoCampingItem[] = [];

    for (let page = 1; page <= totalPages; page++) {
        const items = await fetchCampgrounds({
            pageNo: page,
            numOfRows,
        });

        allItems.push(...items);

        if (onProgress) {
            onProgress(allItems.length, totalCount);
        }

        // API 호출 간격 조절 (Rate Limit 방지)
        if (page < totalPages) {
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
    }

    return allItems;
}
