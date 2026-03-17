
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const url = `${process.env.APP_URL || 'http://localhost:3000'}/api/cron/sync-smart-plan`;
const secret = process.env.CRON_SECRET;

async function trigger() {
  console.log(`Triggering ${url}...`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secret}`,
        'Content-Type': 'application/json'
      },
      // 수동으로 특정 좌표 트리거 (영희네 근처: 예산군청 부근 36.68, 126.84)
      body: JSON.stringify({
        targetLat: 36.6811,
        targetLng: 126.8452,
        targetRegion: '충청남도 예산군'
      })
    });
    
    const status = res.status;
    const body = await res.text();
    console.log(`HTTP Status: ${status}`);
    console.log(`Response Body: ${body}`);
  } catch (err) {
    console.error('Fetch Error:', err);
  }
}

trigger();
