import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const SAFE_KEY = process.env.SAFE_RESTAURANT_API_KEY;

async function testSafeGG() {
    console.log("=== 경기도 안심식당 API 파라미터별 수집 테스트 ===");
    
    const targets = ['경기도', '경기'];
    
    for (const target of targets) {
        console.log(`\n--- Parameter: [${target}] ---`);
        const params = new URLSearchParams({ RELAX_SI_NM: target });
        const url = `http://211.237.50.150:7080/openapi/${SAFE_KEY}/json/Grid_20200713000000000605_1/1/1000?${params.toString()}`;
        
        try {
            console.log(`Calling: ${url}`);
            const res = await fetch(url);
            if (!res.ok) {
                console.error(`HTTP Error: ${res.status}`);
                continue;
            }
            const data = await res.json();
            const items = data.Grid_20200713000000000605_1?.row || [];
            console.log(`수신된 데이터 수: ${items.length}건`);
            if (items.length > 0) {
                console.log(`샘플 데이터[0]:`, JSON.stringify(items[0], null, 2));
            } else {
                console.log("결과 코드:", data.Grid_20200713000000000605_1?.result || data);
            }
        } catch (e) {
            console.error(`Error: ${e.message}`);
        }
    }
}

testSafeGG();
