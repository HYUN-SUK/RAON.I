import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;

async function testKtoApi() {
    console.log('🔍 Testing KTO API (areaBasedList1)...');
    
    // 테스트용 파라미터 (서울 종로구 예시: areaCd=1, signguCd=110)
    // 날짜는 202504 (기존 코드)와 최신 날짜(202503) 모두 테스트
    const dates = ['202504', '202503'];
    
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
            areaCd: '1',
            signguCd: '110' // 시군구 코드 (오타 여부 확인용)
        });

        const urls = [
            `http://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?${params.toString()}`,
            `https://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?${params.toString()}`
        ];

        for (const url of urls) {
            try {
                console.log(`URL: ${url.split('serviceKey=')[0]}...`);
                const res = await fetch(url);
                console.log(`Status: ${res.status}`);
                const text = await res.text();
                console.log(`Response Snippet: ${text.substring(0, 200)}`);
                
                try {
                    const data = JSON.parse(text);
                    const items = data.response?.body?.items?.item || [];
                    console.log(`✅ Success! Found ${items.length} items.`);
                } catch (e) {
                    console.log(`❌ JSON Parse Error: ${e.message}`);
                }
            } catch (e) {
                console.log(`❌ Fetch Error: ${e.message}`);
            }
        }
    }
}

testKtoApi();
