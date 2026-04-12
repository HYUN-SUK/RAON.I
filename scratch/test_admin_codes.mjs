import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const API_KEY = process.env.PUBLIC_DATA_API_KEY;

async function testTmap() {
    console.log('\n--- Testing TMAP Associated Attractions API (ADMIN CODE TEST) ---');
    const params = new URLSearchParams({
        serviceKey: API_KEY,
        numOfRows: '10',
        pageNo: '1',
        MobileOS: 'ETC',
        MobileApp: 'RAONAI',
        _type: 'json',
        baseYm: '202504',  // User suggested 202504
        areaCd: '11',      // Seoul Administrative Code
        signguCd: '11110'  // Jongno Administrative Code
    });
    const url = `http://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?${params.toString()}`;
    console.log(`URL: ${url}`);
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.response?.body?.totalCount > 0) {
            console.log(`  ✅ Success! totalCount: ${data.response.body.totalCount}`);
            console.log('  Sample Item:', data.response.body.items.item[0]);
        } else {
            console.log('  ❌ 0 items. Response:', JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function testKT() {
    console.log('\n--- Testing KT Concentration API (ADMIN CODE TEST) ---');
    const params = new URLSearchParams({
        serviceKey: API_KEY,
        numOfRows: '10',
        pageNo: '1',
        MobileOS: 'ETC',
        MobileApp: 'RAONAI',
        _type: 'json',
        areaCd: '11',
        signguCd: '11110'
    });
    const url = `http://apis.data.go.kr/B551011/TatsCnctrRateService/tatsCnctrRatedList?${params.toString()}`;
    console.log(`URL: ${url}`);
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.response?.body?.totalCount > 0) {
            console.log(`  ✅ Success! totalCount: ${data.response.body.totalCount}`);
            console.log('  Sample Item:', data.response.body.items.item[0]);
        } else {
            console.log('  ❌ 0 items. Response:', JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function run() {
    await testTmap();
    await testKT();
}

run();
