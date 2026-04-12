import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const API_KEY = process.env.PUBLIC_DATA_API_KEY;

async function testTmap() {
    console.log('\n--- Testing TMAP Associated Attractions API (Finding Recent Data) ---');
    const months = ['202602', '202601', '202512', '202406'];
    for (const baseYm of months) {
        const params = new URLSearchParams({
            serviceKey: API_KEY,
            numOfRows: '10',
            pageNo: '1',
            MobileOS: 'ETC',
            MobileApp: 'RAONAI',
            _type: 'json',
            baseYm: baseYm,
            areaCd: '1',  // Seoul
            signguCd: '1' // Jongno
        });
        const url = `http://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?${params.toString()}`;
        console.log(`Trying Month: ${baseYm}`);
        try {
            const res = await fetch(url);
            const data = await res.json();
            if (data.response?.body?.totalCount > 0) {
                console.log(`  ✅ Success for ${baseYm}! totalCount: ${data.response.body.totalCount}`);
                console.log('  Sample Item:', data.response.body.items.item[0]);
                return baseYm;
            } else {
                console.log(`  - ${baseYm}: totalCount 0`);
            }
        } catch (e) {
            console.error(`  - ${baseYm}: Error ${e.message}`);
        }
    }
}

async function testKT() {
    console.log('\n--- Testing KT Concentration Predicted API (Probing for data) ---');
    // For KT, maybe the areaCd/signguCd from KorService2 (1, 1) is not what they expect.
    // Or maybe it's just currently empty for prediction.
    const params = new URLSearchParams({
        serviceKey: API_KEY,
        numOfRows: '10',
        pageNo: '1',
        MobileOS: 'ETC',
        MobileApp: 'RAONAI',
        _type: 'json',
        areaCd: '1',
        signguCd: '1'
    });
    const url = `http://apis.data.go.kr/B551011/TatsCnctrRateService/tatsCnctrRatedList?${params.toString()}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.response?.body?.totalCount > 0) {
            console.log(`  ✅ Success for KT! totalCount: ${data.response.body.totalCount}`);
            return true;
        } else {
            console.log('  - KT: totalCount 0 (Prediction might be empty for this region today)');
        }
    } catch (e) { console.error('  - KT Error:', e.message); }
}

async function run() {
    await testTmap();
    await testKT();
}

run();
