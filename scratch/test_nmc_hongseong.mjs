import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;

async function checkHongseong() {
  console.log("=== Querying NMC Hospital Info for Hongseong-gun ===");
  const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEgytListInfoInqire?serviceKey=${PUBLIC_API_KEY}&Q0=${encodeURIComponent('충청남도')}&Q1=${encodeURIComponent('홍성군')}&pageNo=1&numOfRows=100&_type=json`;
  
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const items = data.response?.body?.items?.item;
    if (items) {
      const list = Array.isArray(items) ? items : [items];
      list.forEach((item, idx) => {
        console.log(`[${idx+1}] dutyName: "${item.dutyName}" | HPID: ${item.hpid} | Address: ${item.dutyAddr}`);
      });
    } else {
      console.log("No items returned from API.");
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
}

checkHongseong();
