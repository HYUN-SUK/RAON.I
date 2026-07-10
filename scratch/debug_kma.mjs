import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const serviceKey = process.env.KMA_SERVICE_KEY;
console.log('KMA_SERVICE_KEY length:', serviceKey ? serviceKey.length : 0);
console.log('KMA_SERVICE_KEY:', serviceKey);

const nx = 61;
const ny = 120;
const todayStr = '20260710';
const baseTimeNow = '1200';

const KMA_BASE_URL = "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";
const urlWithoutEncoding = `${KMA_BASE_URL}/getUltraSrtNcst?serviceKey=${serviceKey}&pageNo=1&numOfRows=10&dataType=JSON&base_date=${todayStr}&base_time=${baseTimeNow}&nx=${nx}&ny=${ny}`;
const urlWithEncoding = `${KMA_BASE_URL}/getUltraSrtNcst?serviceKey=${encodeURIComponent(serviceKey || '')}&pageNo=1&numOfRows=10&dataType=JSON&base_date=${todayStr}&base_time=${baseTimeNow}&nx=${nx}&ny=${ny}`;

async function test() {
    console.log('\n--- 1. Testing without encodeURIComponent ---');
    try {
        const res = await fetch(urlWithoutEncoding);
        const text = await res.text();
        console.log('Status:', res.status);
        console.log('Response (first 800 chars):', text.substring(0, 800));
    } catch (e) {
        console.error('Error:', e.message);
    }

    console.log('\n--- 2. Testing with encodeURIComponent ---');
    try {
        const res = await fetch(urlWithEncoding);
        const text = await res.text();
        console.log('Status:', res.status);
        console.log('Response (first 800 chars):', text.substring(0, 800));
    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();
