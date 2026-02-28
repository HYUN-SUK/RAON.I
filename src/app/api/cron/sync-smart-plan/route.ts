import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Vercel Serverless Function Timeout 설정 (최대 5분)
// 공공 데이터 API 호출 및 DB 저장이 오래 걸릴 수 있으므로 설정
export const maxDuration = 300;

// POST 요청만 허용하여 불필요한 GET 요청 차단 (보안 강화)
export async function POST(request: Request) {
    try {
        // 1. 보안 체크 (Cron Secret 검증)
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. 환경 변수 확인
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const publicApiKey = process.env.PUBLIC_DATA_API_KEY;

        if (!supabaseUrl || !supabaseServiceKey || !publicApiKey) {
            console.error("Missing environment variables for ETL.");
            return NextResponse.json({ error: 'Server Configuration Error' }, { status: 500 });
        }

        // Supabase Admin 권한 클라이언트 생성
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        let allFacts: any[] = [];

        // 서비스 지역 가드 (Regional Guard): 예산군 및 주변 권역 (약 50km) 이외의 데이터 원천 차단
        const isWithinServiceArea = (lat: number, lng: number) => {
            const YESAN_LAT = 36.67;
            const YESAN_LNG = 126.84;
            const dist = Math.sqrt(Math.pow(lat - YESAN_LAT, 2) + Math.pow(lng - YESAN_LNG, 2));
            return dist < 0.6; // 약 60km 반경 (1도 ≒ 111km)
        };

        // =========================================================================
        // [ETL Pipeline] 1. Extract & Transform: 국립중앙의료원 (E-Gen 응급의료기관)
        // =========================================================================
        console.log("Starting ETL: National Medical Center API (Filtered for Chungnam)...");
        try {
            // Q0(충남:34), Q1(예산:420) 필터 추가하여 타 지역 데이터 유입 차단
            const nmcRes = await fetch(`http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${publicApiKey}&Q0=34&Q1=420&pageNo=1&numOfRows=100&_type=json`);
            const nmcData = await nmcRes.json();

            if (nmcData.response?.body?.items?.item) {
                const items = Array.isArray(nmcData.response.body.items.item) ? nmcData.response.body.items.item : [nmcData.response.body.items.item];
                const medicalFacts = items
                    .filter((item: any) => isWithinServiceArea(parseFloat(item.wgs84Lat), parseFloat(item.wgs84Lon)))
                    .map((item: any) => {
                        let score = 50;
                        if (item.dutyName?.includes('소아') || item.dutyName?.includes('아동')) score += 50;

                        return {
                            id: crypto.randomUUID(),
                            api_source: 'NMC_HOSPITAL',
                            category: 'MART_HOSPITAL',
                            name: item.dutyName || '응급의료기관',
                            description: '응급실 가동 응급의료기관',
                            address: item.dutyAddr || '주소 정보 없음',
                            lat: parseFloat(item.wgs84Lat),
                            lng: parseFloat(item.wgs84Lon),
                            trust_score: score,
                            raw_data: item
                        };
                    });
                allFacts = [...allFacts, ...medicalFacts];
            }
        } catch (e) {
            console.error("NMC API Failed:", e);
        }

        // =========================================================================
        // [ETL Pipeline] 2. Extract & Transform: 백년가게 & 안심식당 (Filtered for Yesan)
        // =========================================================================
        console.log("Starting ETL: Restaurants (Filtered for Regional)...");
        try {
            // 백년가게 (소상공인시장진흥공단) - 예산군 법정동 코드(44810) 주변 검색
            const smbaRes = await fetch(`http://apis.data.go.kr/B553077/api/open/sdsc2/storeListInDong?serviceKey=${publicApiKey}&pageNo=1&numOfRows=100&divId=indutyCd&key=Q&type=json`);
            const smbaData = await smbaRes.json();
            if (smbaData.body?.items) {
                const items = Array.isArray(smbaData.body.items) ? smbaData.body.items : [smbaData.body.items];
                const baekFacts = items
                    .filter((item: any) => isWithinServiceArea(parseFloat(item.lat), parseFloat(item.lon)))
                    .map((item: any) => ({
                        id: item.bizesId || crypto.randomUUID(),
                        api_source: 'SMBA_RESTAURANT', category: 'RESTAURANT',
                        name: item.bizesNm, description: `백년가게 인증 ${item.indsMclsNm || '맛집'}`,
                        address: item.lnoAdr || item.rdnmAdr, lat: parseFloat(item.lat), lng: parseFloat(item.lon),
                        trust_score: 50, raw_data: item
                    }));
                allFacts = [...allFacts, ...baekFacts];
            }

            // 안심식당 - 주소 필터링 (예산 포함 식당만)
            const safeRes = await fetch(`http://211.237.50.150:7080/openapi/${process.env.SAFE_RESTAURANT_API_KEY}/json/Grid_20200713000000000605_1/1/100`);
            const safeData = await safeRes.json();
            if (safeData.Grid_20200713000000000605_1?.row) {
                const items = safeData.Grid_20200713000000000605_1.row;
                const safeFacts = items
                    .filter((item: any) => item.RELAX_ADD1?.includes('예산') || item.RELAX_ADD1?.includes('충남'))
                    .map((item: any) => ({
                        id: `safe-${crypto.randomUUID()}`,
                        api_source: 'SAFE_RESTAURANT', category: 'RESTAURANT',
                        name: item.RELAX_REST_NM, description: '농식품부 인증 위생 안심식당',
                        address: item.RELAX_ADD1,
                        lat: 36.67, lng: 126.84, // Safe Restaurant API lacks coords, typically requires geocoding
                        trust_score: 50, raw_data: item
                    }));
                allFacts = [...allFacts, ...safeFacts];
            }
        } catch (e) {
            console.error("Restaurant API Failed:", e);
        }

        // =========================================================================
        // [ETL Pipeline] 3. Extract & Transform: 대규모점포 (Filtered for Region)
        // =========================================================================
        console.log("Starting ETL: Large Stores (Filtered)...");
        try {
            const martRes = await fetch(`http://apis.data.go.kr/B553077/api/open/sdsc2/storeListInDong?serviceKey=${publicApiKey}&pageNo=1&numOfRows=50&divId=indsLclsCd&key=D&type=json`);
            const martData = await martRes.json();
            if (martData.body?.items) {
                const items = Array.isArray(martData.body.items) ? martData.body.items : [martData.body.items];
                const martFacts = items
                    .filter((item: any) => (item.bizesNm?.includes('이마트') || item.bizesNm?.includes('홈플러스') || item.bizesNm?.includes('하나로마트')) && isWithinServiceArea(parseFloat(item.lat), parseFloat(item.lon)))
                    .map((item: any) => ({
                        id: item.bizesId || crypto.randomUUID(),
                        api_source: 'ADMIN_MART', category: 'MART_HOSPITAL',
                        name: item.bizesNm, description: '바베큐/장작 수급 가능한 대형마트',
                        address: item.lnoAdr || item.rdnmAdr, lat: parseFloat(item.lat), lng: parseFloat(item.lon),
                        trust_score: item.bizesNm?.includes('하나로마트') ? 80 : 60,
                        raw_data: item
                    }));
                allFacts = [...allFacts, ...martFacts];
            }
        } catch (e) {
            console.error("Mart API Failed:", e);
        }

        // =========================================================================
        // [ETL Pipeline] 4. Extract & Transform: 오피넷 실내등유 (C004)
        // =========================================================================
        console.log("Starting ETL: Opinet Kerosene...");
        try {
            // 오피넷 API는 ip/도메인 제한이 빡세므로 Vercel Edge에서 실행되는지 확인 필요
            const opinetRes = await fetch(`http://www.opinet.co.kr/api/aroundAll.do?code=${process.env.OPINET_API_KEY}&x=314681&y=544807&radius=10000&sort=1&prodcd=C004&out=json`);
            const opinetData = await opinetRes.json();
            if (opinetData.RESULT?.OIL) {
                const items = Array.isArray(opinetData.RESULT.OIL) ? opinetData.RESULT.OIL : [opinetData.RESULT.OIL];
                const opinetFacts = items.map((item: any) => ({
                    id: item.UNI_ID || crypto.randomUUID(),
                    api_source: 'OPINET', category: 'MART_HOSPITAL',
                    name: item.OS_NM, description: '난방용 실내등유(팬히터용) 취급 주유소',
                    address: '위치 좌표 기반 주유소',
                    // 오피넷은 KATEC 좌표계를 사용하므로 WGS84 변환이 필요하지만 MVP에서는 예산군 중심부 기본값 할당
                    lat: 36.67, lng: 126.84,
                    trust_score: 95, // 동계 생존 필수 가중치
                    raw_data: item
                }));
                allFacts = [...allFacts, ...opinetFacts];
            }
        } catch (e) {
            console.error("Opinet API Failed:", e);
        }

        // =========================================================================
        // [ETL Pipeline] 5. Extract & Transform: 한국관광공사 TourAPI (행사/축제/관광지)
        // =========================================================================
        console.log("Starting ETL: TourAPI...");
        try {
            const tourRes = await fetch(`http://apis.data.go.kr/B551011/KorService1/searchFestival1?serviceKey=${publicApiKey}&numOfRows=50&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&eventStartDate=20240101`);
            const tourData = await tourRes.json();
            if (tourData.response?.body?.items?.item) {
                const items = Array.isArray(tourData.response.body.items.item) ? tourData.response.body.items.item : [tourData.response.body.items.item];
                const tourFacts = items.map((item: any) => ({
                    id: item.contentid || crypto.randomUUID(),
                    api_source: 'TOUR_API', category: 'FESTIVAL',
                    name: item.title, description: '지역 축제 및 행사',
                    address: item.addr1, lat: parseFloat(item.mapy) || 36.67, lng: parseFloat(item.mapx) || 126.84,
                    trust_score: 30, raw_data: item
                }));
                allFacts = [...allFacts, ...tourFacts];
            }
        } catch (e) {
            console.error("TourAPI Failed:", e);
        }

        // =========================================================================
        // [ETL Pipeline] 6. Load: Supabase DB에 적재 (Upsert)
        // =========================================================================
        console.log(`Loading ${allFacts.length} facts into Supabase \`smart_plan_facts\` table...`);

        // DB Insert (Delete all existing ones and insert new)
        if (allFacts.length > 0) {
            // 모든 기존 데이터를 삭제 (cron 주기마다 전체 갱신)
            await supabase.from('smart_plan_facts').delete().not('id', 'is', null);

            // 전부 새 UUID 발급 후 Insert
            const finalFacts = allFacts.map(fact => ({
                ...fact,
                id: crypto.randomUUID()
            }));

            const { error } = await supabase
                .from('smart_plan_facts')
                .insert(finalFacts);

            if (error) {
                console.error("Supabase Insert Error:", error);
                throw new Error(`DB Insert Failed: ${error.message}`);
            }
        }

        return NextResponse.json({
            success: true,
            message: 'ETL Pipeline executed successfully',
            processed_count: allFacts.length
        });

    } catch (error: any) {
        console.error("ETL Cron Job Error:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
