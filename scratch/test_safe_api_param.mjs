import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SAFE_API_KEY = process.env.SAFE_RESTAURANT_API_KEY;

async function testSafeApiParams() {
    console.log('--- 농식품부 안심식당 파라미터 테스트 ---');
    const tests = ['전남', '광주', '전라남도', '광주광역시', '전남광주', ''];

    for (const t of tests) {
        const params = t ? `?RELAX_SI_NM=${encodeURIComponent(t)}` : '';
        const url = `http://211.237.50.150:7080/openapi/${SAFE_API_KEY}/json/Grid_20200713000000000605_1/1/5${params}`;
        try {
            const res = await fetch(url);
            const data = await res.json();
            const total = data.Grid_20200713000000000605_1?.totalCnt || 0;
            const firstAddr = data.Grid_20200713000000000605_1?.row?.[0]?.RELAX_ADD1 || 'N/A';
            console.log(`[파라미터: '${t}'] totalCnt: ${total} | 첫번째 주소: ${firstAddr}`);
        } catch (e) {
            console.log(`[파라미터: '${t}'] 에러: ${e.message}`);
        }
    }
}

testSafeApiParams();
