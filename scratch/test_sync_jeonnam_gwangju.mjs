import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

const SIDO_ALIASES = {
    '전남광주': ['전남광주', '전남광주시', '광주전남', '광주광역시', '전라남도', '광주', '전남']
};

async function testJeonnamGwangju() {
    console.log('====================================================');
    console.log('🔍 전남광주 DB 기존 데이터 수 및 API 수신 실측 점검');
    console.log('====================================================\n');

    const targetSido = '전남광주시';
    const aliases = SIDO_ALIASES['전남광주'];

    // 1. 현재 DB에 저장된 sido 값별 카운트 확인
    console.log('1. [DB 기존 데이터 실측]');
    const { count: countExactSido } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .eq('sido', targetSido);
    console.log(`- .eq('sido', '${targetSido}') 조회 시: ${countExactSido}건 (버그 원인: 0건으로 잡힘)`);

    const { count: countGwangju } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .eq('sido', '광주광역시');
    console.log(`- .eq('sido', '광주광역시') 조회 시: ${countGwangju}건`);

    const { count: countJeonnam } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .eq('sido', '전라남도');
    console.log(`- .eq('sido', '전라남도') 조회 시: ${countJeonnam}건`);

    // 2. 안심식당 API 테스트 (농식품부)
    console.log('\n2. [안심식당 API 실측]');
    const SAFE_API_KEY = process.env.SAFE_RESTAURANT_API_KEY;
    for (const callName of ['광주광역시', '전라남도', '전남광주시']) {
        const params = new URLSearchParams({ RELAX_SI_NM: callName });
        try {
            const res = await fetch(`http://211.237.50.150:7080/openapi/${SAFE_API_KEY}/json/Grid_20200713000000000605_1/1/5?${params.toString()}`);
            const data = await res.json();
            const total = data.Grid_20200713000000000605_1?.totalCnt || 0;
            console.log(`- 안심식당 [${callName}] 파라미터 호출 결과: totalCnt = ${total}`);
        } catch (e) {
            console.log(`- 안심식당 [${callName}] 호출 실패: ${e.message}`);
        }
    }

    // 3. TourAPI 관광명소 테스트
    console.log('\n3. [TourAPI 관광명소 실측]');
    const TOUR_KEY = process.env.TOUR_API_KEY;
    for (const areaCode of ['5', '36', '38']) {
        const url = `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${TOUR_KEY}&numOfRows=5&pageNo=1&MobileOS=ETC&MobileApp=RAONI&_type=json&areaCode=${areaCode}`;
        try {
            const res = await fetch(url);
            const data = await res.json();
            const total = data?.response?.body?.totalCount || 0;
            console.log(`- TourAPI [areaCode=${areaCode}] 호출 결과 (5=광주, 36=전남, 38=기존맵): totalCount = ${total}`);
        } catch (e) {
            console.log(`- TourAPI [areaCode=${areaCode}] 호출 실패: ${e.message}`);
        }
    }
}

testJeonnamGwangju();
