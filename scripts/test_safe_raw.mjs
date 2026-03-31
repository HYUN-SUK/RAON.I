import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const SAFE_KEY = process.env.SAFE_RESTAURANT_API_KEY;

async function testSafeAPI() {
    console.log("--- [TEST] 안심식당 API (IP: 211.237.50.150) ---");
    
    if (!SAFE_KEY) {
        console.error("  [Error] SAFE_RESTAURANT_API_KEY가 설정되지 않았습니다.");
        return;
    }

    const url = `http://211.237.50.150:7080/openapi/${SAFE_KEY}/json/Grid_20200713000000000605_1/1/10`;
    
    try {
        console.log(`  Calling: ${url}`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃
        
        const res = await fetch(url, { 
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: controller.signal 
        });
        clearTimeout(timeout);

        if (!res.ok) {
            console.error(`  [HTTP Error] ${res.status}`);
            return;
        }

        const data = await res.json();
        console.log("Response Structure:", JSON.stringify(Object.keys(data), null, 2));
        
        const rows = data.Grid_20200713000000000605_1?.row || [];
        if (rows.length > 0) {
            console.log(`Sample Item[0]:`, JSON.stringify(rows[0], null, 2));
        } else {
            console.warn("  [Warning] No rows returned (Result Code check needed)");
            console.log("Full JSON:", JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error(`  [Critical Error] ${e.message}`);
    }
}

testSafeAPI();
