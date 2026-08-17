import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SAFE_API_KEY = process.env.SAFE_RESTAURANT_API_KEY;

async function testAllSidos() {
    const sidos = ['서울특별시', '경기도', '경상북도', '강원특별자치도', '충청북도', '부산광역시'];
    for (const s of sidos) {
        const url = `http://211.237.50.150:7080/openapi/${SAFE_API_KEY}/json/Grid_20200713000000000605_1/1/5?RELAX_SI_NM=${encodeURIComponent(s)}`;
        const res = await fetch(url);
        const d = await res.json();
        console.log(`[${s}] totalCnt:`, d.Grid_20200713000000000605_1?.totalCnt);
    }
}

testAllSidos();
