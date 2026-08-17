import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SAFE_API_KEY = process.env.SAFE_RESTAURANT_API_KEY;

async function testSafeFilter() {
    // 1. URLSearchParams 없이 직접 쿼리
    const url1 = `http://211.237.50.150:7080/openapi/${SAFE_API_KEY}/json/Grid_20200713000000000605_1/1/5?RELAX_SI_NM=${encodeURIComponent('전라남도')}`;
    const res1 = await fetch(url1);
    const d1 = await res1.json();
    console.log('1. RELAX_SI_NM=전라남도 인코딩:', d1.Grid_20200713000000000605_1?.totalCnt);

    const url2 = `http://211.237.50.150:7080/openapi/${SAFE_API_KEY}/json/Grid_20200713000000000605_1/1/5?RELAX_SI_NM=${encodeURIComponent('광주광역시')}`;
    const res2 = await fetch(url2);
    const d2 = await res2.json();
    console.log('2. RELAX_SI_NM=광주광역시 인코딩:', d2.Grid_20200713000000000605_1?.totalCnt);

    const url3 = `http://211.237.50.150:7080/openapi/${SAFE_API_KEY}/json/Grid_20200713000000000605_1/1/5?RELAX_SI_NM=${encodeURIComponent('전남광주시')}`;
    const res3 = await fetch(url3);
    const d3 = await res3.json();
    console.log('3. RELAX_SI_NM=전남광주시 인코딩:', d3.Grid_20200713000000000605_1?.totalCnt);
}

testSafeFilter();
