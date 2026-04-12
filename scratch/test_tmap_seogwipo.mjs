import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const API_KEY = process.env.PUBLIC_DATA_API_KEY;

async function testTmap() {
    console.log('\n--- Testing TMAP Associated Attractions API (Seogwipo) ---');
    const params = new URLSearchParams({
        serviceKey: API_KEY,
        numOfRows: '100',
        pageNo: '1',
        MobileOS: 'ETC',
        MobileApp: 'RAONAI',
        _type: 'json',
        baseYm: '202405',
        areaCd: '39', 
        signguCd: '4' // 서귀포시
    });
    const url = `http://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?${params.toString()}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        const items = data.response?.body?.items?.item;
        if (items) {
            console.log('✅ Found Items:', Array.isArray(items) ? items.length : 1);
            console.log('Sample:', JSON.stringify(Array.isArray(items) ? items[0] : items, null, 2));
        } else {
            console.log('No items found. Response:', JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

testTmap();
