import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const CRON_SECRET = process.env.CRON_SECRET;

async function testTrigger() {
    console.log("=== 프로덕션 축제 동기화 API 호출 테스트 ===");
    console.log(`Using CRON_SECRET: ${CRON_SECRET}`);
    
    const url = `https://raonai.com/api/cron/sync-festivals?secret=${CRON_SECRET}`;
    console.log(`Calling: ${url}`);
    
    try {
        const res = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${CRON_SECRET}`
            },
            timeout: 10000 // 10초 타임아웃
        });
        
        console.log(`HTTP Status: ${res.status}`);
        const text = await res.text();
        console.log("Response Body (Truncated):");
        console.log(text.substring(0, 1000));
    } catch (e) {
        console.error(`호출 에러: ${e.message}`);
    }
}

testTrigger();
