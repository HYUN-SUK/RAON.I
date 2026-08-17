import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SAFE_API_KEY = process.env.SAFE_RESTAURANT_API_KEY;

async function testIntegratedSido() {
    const url = `http://211.237.50.150:7080/openapi/${SAFE_API_KEY}/json/Grid_20200713000000000605_1/1/5?RELAX_SI_NM=${encodeURIComponent('전남광주통합특별시')}`;
    const res = await fetch(url);
    const d = await res.json();
    console.log('[전남광주통합특별시] 안심식당 totalCnt:', d.Grid_20200713000000000605_1?.totalCnt);
    console.log('첫 번째 식당 주소:', d.Grid_20200713000000000605_1?.row?.[0]?.RELAX_ADD1);
}

testIntegratedSido();
