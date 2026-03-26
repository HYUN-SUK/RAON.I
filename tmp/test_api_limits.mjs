import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;

async function testLimit() {
    const limits = [100, 200, 500, 1000];
    for (const limit of limits) {
        const url = `http://apis.data.go.kr/1741000/large_scale_retail_stores/info?serviceKey=${PUBLIC_API_KEY}&pageNo=1&numOfRows=${limit}&returnType=JSON&cond[SALS_STTS_CD::EQ]=01`;
        const res = await fetch(url);
        const data = await res.json();
        const count = data.response?.body?.items?.item?.length || 0;
        console.log(`Limit: ${limit}, Received: ${count}`);
    }
}

testLimit();
