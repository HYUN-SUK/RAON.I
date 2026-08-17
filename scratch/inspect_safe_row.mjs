import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SAFE_API_KEY = process.env.SAFE_RESTAURANT_API_KEY;

async function inspectSafeRow() {
    const url = `http://211.237.50.150:7080/openapi/${SAFE_API_KEY}/json/Grid_20200713000000000605_1/1/5`;
    const res = await fetch(url);
    const data = await res.json();
    console.log('농식품부 안심식당 첫 번째 row:', data.Grid_20200713000000000605_1?.row?.[0]);
}

inspectSafeRow();
