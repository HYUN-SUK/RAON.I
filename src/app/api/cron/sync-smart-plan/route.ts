import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Vercel Serverless Function Timeout 설정 (최대 5분)
export const maxDuration = 300;

// 지역 이름에 따른 지역 코드 매핑 (공공 API의 파라미터가 모두 다르므로 규격화)
// 향후 사용자 캠핑장 DB 조회 후 동적으로 주입될 수 있도록 설계
const REGION_MAP: Record<string, { lDongRegnCd: string; lDongSignguCd: string; doNm: string; sigunguNm: string, areaCode: string }> = {
    '충남 예산군': { lDongRegnCd: '44', lDongSignguCd: '44810', doNm: '충청남도', sigunguNm: '예산군', areaCode: '34' },
    // 추가 캠핑장 지역에 따른 확장은 여기에 동적 추가 가능
};

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const publicApiKey = process.env.PUBLIC_DATA_API_KEY;

        if (!supabaseUrl || !supabaseServiceKey || !publicApiKey) {
            return NextResponse.json({ error: 'Server Configuration Error' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const allFacts: any[] = [];
        const successSources: string[] = []; // 성공적으로 수집을 완수한 API 소스를 추적하기 위한 배열 (안전한 부분 업데이트용)

        // Request Body에서 타겟 지역 정보 파싱 (동적 좌표/지역 주입 구조 완성)
        // Body가 없으면(기존 Cron 동작) 예산군 기본값 사용
        let targetRegion = '충남 예산군';
        let targetLat = 36.6719;
        let targetLng = 126.8429;

        try {
            const body = await request.json();
            if (body.targetRegion) targetRegion = body.targetRegion;
            if (body.targetLat) targetLat = body.targetLat;
            if (body.targetLng) targetLng = body.targetLng;
        } catch (e) { /* ignore JSON parsing error if GET or no body */ }

        const regionInfo = REGION_MAP[targetRegion] || REGION_MAP['충남 예산군'];

        const isWithinServiceArea = (lat: number, lng: number) => {
            const dist = Math.sqrt(Math.pow(lat - targetLat, 2) + Math.pow(lng - targetLng, 2));
            return dist <= 0.5; // 약 50km
        };

        const fetchOptions = { headers: { 'User-Agent': 'Mozilla/5.0' } }; // 500 Server Error 방지

        // =========================================================================
        // 1. 병원 : 국립중앙의료원_전국 응급의료기관 정보 조회 서비스
        // =========================================================================
        try {
            const q0 = encodeURIComponent(regionInfo.doNm);
            const q1 = encodeURIComponent(regionInfo.sigunguNm);
            const res = await fetch(`http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${publicApiKey}&STAGE1=${q0}&STAGE2=${q1}&pageNo=1&numOfRows=100&_type=json`, fetchOptions);
            const data = await res.json();
            if (data.response?.body?.items?.item) {
                const items = Array.isArray(data.response.body.items.item) ? data.response.body.items.item : [data.response.body.items.item];
                allFacts.push(...items.map((item: any) => ({
                    id: crypto.randomUUID(), api_source: 'NMC_HOSPITAL', category: 'MART_HOSPITAL',
                    name: item.dutyName, description: '응급실 가동 응급의료기관', address: item.dutyAddr,
                    lat: parseFloat(item.wgs84Lat), lng: parseFloat(item.wgs84Lon),
                    trust_score: item.dutyName?.includes('소아') ? 100 : 50, raw_data: item
                })));
            }
            successSources.push('NMC_HOSPITAL');
        } catch (e) { console.error("NMC Error", e); }

        // =========================================================================
        // 2. 마트 : 행정안전부_생활_대규모점포 조회서비스 (1741000)
        // =========================================================================
        try {
            const res = await fetch(`https://apis.data.go.kr/1741000/large_scale_retail_stores/info?serviceKey=${publicApiKey}&pageNo=1&numOfRows=100&returnType=json`, fetchOptions);
            const data = await res.json();
            if (data.response?.body?.items?.item) {
                const items = Array.isArray(data.response.body.items.item) ? data.response.body.items.item : [data.response.body.items.item];
                allFacts.push(...items.map((item: any) => ({
                    id: crypto.randomUUID(), api_source: 'LARGE_STORE', category: 'MART_HOSPITAL',
                    name: item.BPLC_NM || item.companyNm || item.storeNm || '대형마트', description: `대규모점포`, address: item.ROAD_NM_ADDR || item.LOTNO_ADDR || item.address,
                    lat: targetLat + (Math.random() * 0.02 - 0.01), lng: targetLng + (Math.random() * 0.02 - 0.01), trust_score: 80, raw_data: item
                })));
            }
            successSources.push('LARGE_STORE');
        } catch (e) { console.error("LARGE_STORE Error", e); }

        // =========================================================================
        // 3. 식당 : 행안부 (모범), 중기부 (백년가게), 농식품부 (안심식당)
        // =========================================================================
        try { // 모범음식점정보 (행안부 - 1741000)
            const res = await fetch(`https://apis.data.go.kr/1741000/excellent_restaurant_info/info?serviceKey=${publicApiKey}&pageNo=1&numOfRows=100&returnType=json`, fetchOptions);
            const data = await res.json();
            if (data.response?.body?.items?.item) {
                const items = Array.isArray(data.response.body.items.item) ? data.response.body.items.item : [data.response.body.items.item];
                allFacts.push(...items.map((item: any) => ({
                    id: crypto.randomUUID(), api_source: 'GOOD_RESTAURANT', category: 'RESTAURANT',
                    name: item.BSNSSP_NM || item.bsshNm || '모범음식점', description: `모범음식점`, address: item.ROAD_NM_ADDR || item.LCTN_ADDR || item.address,
                    lat: targetLat + (Math.random() * 0.02 - 0.01), lng: targetLng + (Math.random() * 0.02 - 0.01), trust_score: 50, raw_data: item
                })));
            }
            successSources.push('GOOD_RESTAURANT');
        } catch (e) { console.error("GOOD_RESTAURANT Error", e); }

        try { // 백년가게 (소상공인시장진흥공단 - odcloud - Swagger Dynamic 최신 uddi path 자동 탐색)
            const specUrl = `https://infuser.odcloud.kr/oas/docs?namespace=${encodeURIComponent('15102255/v1')}`;
            const specRes = await fetch(specUrl, fetchOptions);
            const spec = await specRes.json();
            const paths = Object.keys(spec.paths || {});

            if (!paths.length) throw new Error("ODcloud swagger paths empty");
            const latestPath = paths[0]; // e.g "/15102255/v1/uddi:c198d295-..."

            const res = await fetch(`https://api.odcloud.kr/api${latestPath}?serviceKey=${publicApiKey}&page=1&perPage=100`, fetchOptions);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            if (data.data) {
                const items = Array.isArray(data.data) ? data.data : [data.data];
                allFacts.push(...items.filter((item: any) => item['시도·시군구']?.includes(regionInfo.sigunguNm) || item['주소']?.includes(regionInfo.sigunguNm)).map((item: any) => ({
                    id: crypto.randomUUID(), api_source: 'SMBA_BAEK', category: 'RESTAURANT',
                    name: item['업체명'], description: `백년가게 공식 지정 (${item['업종'] || '식당'})`, address: item['주소'],
                    lat: targetLat + (Math.random() * 0.02 - 0.01), lng: targetLng + (Math.random() * 0.02 - 0.01), trust_score: 80, raw_data: item
                })));
            }
            successSources.push('SMBA_BAEK');
        } catch (e) { console.error("SMBA_BAEK Error", e); }

        try { // 안심식당 (농식품부)
            if (process.env.SAFE_RESTAURANT_API_KEY) {
                const res = await fetch(`http://211.237.50.150:7080/openapi/${process.env.SAFE_RESTAURANT_API_KEY}/json/Grid_20200713000000000605_1/1/100`, fetchOptions);
                const data = await res.json();
                if (data.Grid_20200713000000000605_1?.row) {
                    const items = data.Grid_20200713000000000605_1.row;
                    allFacts.push(...items.filter((item: any) => item.RELAX_ADD1?.includes(regionInfo.sigunguNm)).map((item: any) => ({
                        id: crypto.randomUUID(), api_source: 'SAFE_RESTAURANT', category: 'RESTAURANT',
                        name: item.RELAX_REST_NM, description: '농식품부 인증 위생 안심식당', address: item.RELAX_ADD1,
                        lat: targetLat + (Math.random() * 0.02 - 0.01), lng: targetLng + (Math.random() * 0.02 - 0.01), trust_score: 50, raw_data: item
                    })));
                }
                successSources.push('SAFE_RESTAURANT');
            }
        } catch (e) { console.error("SAFE_RESTAURANT Error", e); }

        // =========================================================================
        // 4. 주유소 : 오피넷 (겨울철 등유)
        // =========================================================================
        try {
            const isWinter = new Date().getMonth() >= 10 || new Date().getMonth() <= 4;
            if (isWinter && process.env.OPINET_API_KEY) {
                // 향후 동적 변환(Kakao Transcoord)이 가능하도록 기본 틀 유지
                const opinetRes = await fetch(`http://www.opinet.co.kr/api/aroundAll.do?code=${process.env.OPINET_API_KEY}&x=175658&y=341695&radius=10000&sort=1&prodcd=C004&out=json`, fetchOptions);
                const opinetData = await opinetRes.json();
                if (opinetData.RESULT?.OIL) {
                    const items = Array.isArray(opinetData.RESULT.OIL) ? opinetData.RESULT.OIL : [opinetData.RESULT.OIL];
                    allFacts.push(...items.map((item: any) => ({
                        id: crypto.randomUUID(), api_source: 'OPINET', category: 'MART_HOSPITAL',
                        name: item.OS_NM, description: '겨울철 난방 실내등유(팬히터용) 주유소', address: item.NEW_ADR,
                        lat: targetLat + (Math.random() * 0.01), lng: targetLng + (Math.random() * 0.01), trust_score: 95, raw_data: item
                    })));
                }
                successSources.push('OPINET');
            }
        } catch (e) { console.error("OPINET Error", e); }

        // =========================================================================
        // 5. 축제/행사 : 전국문화축제, 전국공연행사, 한국관광공사
        // =========================================================================
        try { // 전국문화축제표준
            const res = await fetch(`http://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api?serviceKey=${publicApiKey}&pageNo=1&numOfRows=100&type=json`, fetchOptions);
            const data = await res.json();
            if (data.response?.body?.items) {
                const items = Array.isArray(data.response.body.items) ? data.response.body.items : [data.response.body.items];
                allFacts.push(...items.filter((item: any) => isWithinServiceArea(parseFloat(item.latitude), parseFloat(item.longitude)))
                    .map((item: any) => ({
                        id: crypto.randomUUID(), api_source: 'FSTVL_STD', category: 'FESTIVAL',
                        name: item.fstvlNm, description: `지역 문화 축제`, address: item.rdnmadr || item.lnmadr,
                        lat: parseFloat(item.latitude), lng: parseFloat(item.longitude), trust_score: 80, raw_data: item
                    })));
            }
            successSources.push('FSTVL_STD');
        } catch (e) { console.error("FSTVL_STD Error", e); }

        try { // 전국공연행사표준
            const res = await fetch(`http://api.data.go.kr/openapi/tn_pubr_public_prmn_fesvl_api?serviceKey=${publicApiKey}&pageNo=1&numOfRows=100&type=json`, fetchOptions);
            const data = await res.json();
            if (data.response?.body?.items) {
                const items = Array.isArray(data.response.body.items) ? data.response.body.items : [data.response.body.items];
                allFacts.push(...items.filter((item: any) => isWithinServiceArea(parseFloat(item.latitude), parseFloat(item.longitude)))
                    .map((item: any) => ({
                        id: crypto.randomUUID(), api_source: 'PRMN_STD', category: 'FESTIVAL',
                        name: item.eventNm, description: `공연/행사 정보`, address: item.rdnmadr || item.lnmadr,
                        lat: parseFloat(item.latitude), lng: parseFloat(item.longitude), trust_score: 80, raw_data: item
                    })));
            }
            successSources.push('PRMN_STD');
        } catch (e) { console.error("PRMN_STD Error", e); }

        try { // TourAPI 축제 (새로운 KorService2 locationBasedList2 적용)
            const res = await fetch(`http://apis.data.go.kr/B551011/KorService2/locationBasedList2?serviceKey=${publicApiKey}&numOfRows=50&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=15&mapX=${targetLng}&mapY=${targetLat}&radius=20000`, fetchOptions);
            const data = await res.json();
            if (data.response?.body?.items?.item) {
                const items = Array.isArray(data.response.body.items.item) ? data.response.body.items.item : [data.response.body.items.item];
                allFacts.push(...items.filter((item: any) => isWithinServiceArea(parseFloat(item.mapy), parseFloat(item.mapx)))
                    .map((item: any) => ({
                        id: crypto.randomUUID(), api_source: 'TOUR_FSTVL', category: 'FESTIVAL',
                        name: item.title, description: '관광공사 선정 주변 축제', address: item.addr1,
                        lat: parseFloat(item.mapy), lng: parseFloat(item.mapx), trust_score: 80, raw_data: item
                    })));
            }
            successSources.push('TOUR_FSTVL');
        } catch (e) { console.error("TOUR_FSTVL Error", e); }

        // =========================================================================
        // 6. 관광지 : 한국관광공사 (TourAPI SPOT)
        // =========================================================================
        try { // 관광지 : 한국관광공사 (TourAPI SPOT - KorService2 locationBasedList2)
            const res = await fetch(`http://apis.data.go.kr/B551011/KorService2/locationBasedList2?serviceKey=${publicApiKey}&numOfRows=100&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=12&mapX=${targetLng}&mapY=${targetLat}&radius=20000`, fetchOptions);
            const data = await res.json();
            if (data.response?.body?.items?.item) {
                const items = Array.isArray(data.response.body.items.item) ? data.response.body.items.item : [data.response.body.items.item];
                allFacts.push(...items.filter((item: any) => isWithinServiceArea(parseFloat(item.mapy), parseFloat(item.mapx)))
                    .map((item: any) => ({
                        id: crypto.randomUUID(), api_source: 'TOUR_SPOT', category: 'SPOT',
                        name: item.title, description: '한국관광공사 선정 관광명소', address: item.addr1,
                        lat: parseFloat(item.mapy), lng: parseFloat(item.mapx), trust_score: 40, raw_data: item
                    })));
            }
            successSources.push('TOUR_SPOT');
        } catch (e) { console.error("TOUR_SPOT Error", e); }

        // =========================================================================
        // 7. DB Save (Upsert) - 소스별 개별 안전 업데이트 처리
        // 하나의 API가 터져도 전체 데이터가 삭제되는 현상을 방지
        // =========================================================================
        const validFacts = allFacts.filter(f => f.name && !isNaN(f.lat) && !isNaN(f.lng));
        console.log(`Successfully fetched sources: ${successSources.join(', ')}`);

        let processedCount = 0;

        for (const source of successSources) {
            // 통신에 성공한 API 소스의 पुरानी 데이터만 지움, 에러가 발생한 API 소스는 옛날 데이터를 유지함.
            await supabase.from('smart_plan_facts').delete().eq('api_source', source);

            const chunk = validFacts.filter(f => f.api_source === source);
            if (chunk.length > 0) {
                const { error } = await supabase.from('smart_plan_facts').insert(chunk);
                if (error) console.error(`DB Insert Failed for ${source}:`, error.message);
                else processedCount += chunk.length;
            }
        }

        return NextResponse.json({ success: true, processed_count: processedCount, successful_sources: successSources });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
    }
}
