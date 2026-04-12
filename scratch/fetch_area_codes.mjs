import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const API_KEY = process.env.PUBLIC_DATA_API_KEY;

async function getSigunguCodes(areaCode) {
    const params = new URLSearchParams({
        serviceKey: API_KEY,
        numOfRows: '100',
        pageNo: '1',
        MobileOS: 'ETC',
        MobileApp: 'RAONAI',
        _type: 'json',
        areaCode: areaCode.toString()
    });

    const url = `http://apis.data.go.kr/B551011/KorService2/areaCode?${params.toString()}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        const items = data.response?.body?.items?.item;
        console.log(`\n--- Sigungu Codes for Area ${areaCode} ---`);
        if (items) {
            const list = Array.isArray(items) ? items : [items];
            list.forEach(i => console.log(`${i.code}: ${i.name}`));
            return list;
        } else {
            console.log('No item found for area', areaCode);
        }
    } catch (e) {
        console.error('Error fetching area codes:', e.message);
    }
}

async function run() {
    await getSigunguCodes(1); // Seoul
    await getSigunguCodes(39); // Jeju
}

run();
