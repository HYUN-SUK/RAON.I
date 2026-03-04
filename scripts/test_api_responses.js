const fetch = require('node-fetch');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const KMA_KEY = process.env.KMA_SERVICE_KEY;
const TOUR_KEY = process.env.TOUR_API_KEY;

async function testApis() {
    console.log('--- Testing APIs with 09:00 AM Params ---');

    // 1. Tour API (Nearby Events)
    const todayStr = '20260301';
    const tourUrl = `https://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${TOUR_KEY}&MobileOS=ETC&MobileApp=RAONI&_type=json&numOfRows=1000&arrange=A&eventStartDate=${todayStr}`;

    console.log('\n[1] Testing Tour API...');
    try {
        const res = await fetch(tourUrl);
        console.log('Status:', res.status);
        const text = await res.text();
        console.log('First 200 chars:', text.substring(0, 200));
        try {
            const json = JSON.parse(text);
            console.log('JSON Structure Check:', !!json?.response?.body?.items);
        } catch (e) {
            console.log('JSON Parse Failed - Response might be XML or Error string');
        }
    } catch (e) {
        console.error('Fetch Error:', e);
    }

    // 2. KMA Vilage Forecast (Weather)
    const baseDate = '20260301';
    const baseTime = '0800'; // Parms at 09:00 AM
    const nx = 60, ny = 127; // Seoul
    const vilageUrl = `http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${encodeURIComponent(KMA_KEY)}&numOfRows=1000&pageNo=1&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`;

    console.log('\n[2] Testing KMA Vilage API...');
    try {
        const res = await fetch(vilageUrl);
        console.log('Status:', res.status);
        const text = await res.text();
        console.log('First 200 chars:', text.substring(0, 200));
        try {
            const json = JSON.parse(text);
            console.log('JSON Structure Check:', !!json?.response?.body?.items);
        } catch (e) {
            console.log('JSON Parse Failed');
        }
    } catch (e) {
        console.error('Fetch Error:', e);
    }

    // 3. KMA Mid Term (Land)
    const tmFc = '202603010600'; // Params at 09:00 AM
    const landCode = '11B00000';
    const landUrl = `http://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst?serviceKey=${KMA_KEY}&numOfRows=10&pageNo=1&dataType=JSON&regId=${landCode}&tmFc=${tmFc}`;

    console.log('\n[3] Testing KMA MidLand API...');
    try {
        const res = await fetch(landUrl);
        console.log('Status:', res.status);
        const text = await res.text();
        console.log('First 200 chars:', text.substring(0, 200));
        try {
            const json = JSON.parse(text);
            console.log('JSON Structure Check:', !!json?.response?.body?.items);
        } catch (e) {
            console.log('JSON Parse Failed');
        }
    } catch (e) {
        console.error('Fetch Error:', e);
    }
}

testApis();
