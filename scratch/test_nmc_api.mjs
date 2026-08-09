import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const MOIS_API_KEY = process.env.MOIS_API_KEY || process.env.PUBLIC_DATA_API_KEY;

async function testNmcApi(sido) {
    const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${MOIS_API_KEY}&STAGE1=${encodeURIComponent(sido)}&STAGE2=&pageNo=1&numOfRows=100&_type=json`;
    console.log(`\nTesting NMC API for Sido: "${sido}"`);
    console.log(`URL: ${url.replace(MOIS_API_KEY, 'SECRET_KEY')}`);

    try {
        const res = await fetch(url, { timeout: 10000 });
        const text = await res.text();
        console.log(`Response status: ${res.status}`);
        console.log(`Response length: ${text.length}`);
        
        // Print first 500 characters of response
        console.log(`Preview:`, text.slice(0, 500));
        
        try {
            const json = JSON.parse(text);
            console.log(`-> JSON parsing successful!`);
            const items = json.response?.body?.items?.item;
            console.log(`-> Items found:`, items ? (Array.isArray(items) ? items.length : 1) : 0);
        } catch (jsonErr) {
            console.log(`-> JSON parsing FAILED. Response might be XML.`);
        }
    } catch (e) {
        console.error(`-> Fetch FAILED:`, e.message);
    }
}

async function runAll() {
    if (!MOIS_API_KEY) {
        console.error('Missing MOIS_API_KEY in env');
        return;
    }
    await testNmcApi('대전광역시'); // 정상 케이스 대조군
    await testNmcApi('울산광역시'); // 문제 케이스 1
    await testNmcApi('세종특별자치시'); // 문제 케이스 2
}

runAll();
