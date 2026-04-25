import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;

async function testNewKtoApi() {
    console.log('🚀 Testing New KTO API (LocgoHubTarService1) with CORRECT Params...');
    
    // 2025년 1월부터 역순으로 6개월치 스캔
    const dates = ['202504', '202503', '202502', '202501', '202412', '202411'];
    
    for (const date of dates) {
        console.log(`\n--- Testing Date: ${date} ---`);
        const params = new URLSearchParams({
            serviceKey: PUBLIC_API_KEY,
            numOfRows: '10',
            pageNo: '1',
            MobileOS: 'ETC',
            MobileApp: 'RAONAI',
            _type: 'json',
            baseYm: date,
            areaCd: '1',       // 정확한 파라미터명
            signguCd: '110'     // 정확한 파라미터명
        });

        const url = `http://apis.data.go.kr/B551011/LocgoHubTarService1/areaBasedList1?${params.toString()}`;

        try {
            const res = await fetch(url);
            const data = await res.json();
            
            console.log(`Result: ${data.response?.header?.resultMsg || 'OK'}`);
            const items = data.response?.body?.items?.item || [];
            console.log(`✅ Received ${items.length} items.`);
            
            if (items.length > 0) {
                console.log('Sample Data Found!');
                console.log(`[1] ${items[0].itsBroNm} (Rank: ${items[0].rank})`);
                break; 
            }
        } catch (e) {
            console.error(`❌ Error: ${e.message}`);
        }
    }
}

testNewKtoApi();
