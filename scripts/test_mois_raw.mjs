import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;

async function testEndpoints() {
    const endpoints = [
        { name: '대포(MART)', endpoint: 'large_scale_retail_stores' },
        { name: '모범(RESTAURANT)', endpoint: 'excellent_restaurant_info' }
    ];

    for (const ep of endpoints) {
        console.log(`\n--- [TEST] ${ep.name} (endpoint: ${ep.endpoint}) ---`);
        const url = `http://apis.data.go.kr/1741000/${ep.endpoint}/info?serviceKey=${PUBLIC_API_KEY}&pageNo=1&numOfRows=5&returnType=json`;
        
        try {
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (!res.ok) {
                console.error(`  [HTTP Error] ${res.status}`);
                continue;
            }
            const data = await res.json();
            console.log("Raw Response Structure (Header):", JSON.stringify(data.response?.header || data.header, null, 2));
            
            const body = data.response?.body || data.body;
            const items = body?.items?.item || [];
            const itemList = Array.isArray(items) ? items : [items];
            
            if (itemList.length > 0) {
                console.log(`Sample Item[0] Keys:`, Object.keys(itemList[0]));
                console.log(`Sample Item[0] Data:`, JSON.stringify(itemList[0], null, 2));
            } else {
                console.warn(`  [Warning] No items returned from ${ep.name}`);
            }
        } catch (e) {
            console.error(`  [Error] ${e.message}`);
        }
    }
}

testEndpoints();
