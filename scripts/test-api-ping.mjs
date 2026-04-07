import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
  console.log("=== RATE LIMIT TEST ===");
  try {
    const tourUrl = `https://apis.data.go.kr/B551011/KorService2/areaCode2?serviceKey=${process.env.TOUR_API_KEY}&_type=json&numOfRows=1&MobileOS=ETC&MobileApp=RAONAI`;
    const r1 = await fetch(tourUrl);
    const t1 = await r1.text();
    console.log(`[TOUR_API] ok: ${r1.ok}, status: ${r1.status}`);
    console.log(`[TOUR_API] Raw Output: ${t1.substring(0, 150)}`);
  } catch(e) { console.log(`[TOUR_API] Error: ${e.message}`); }

  try {
    const moisUrl = `https://api.odcloud.kr/api/15102255/v1/uddi:c8c0f585-8ee0-47a3-8686-3507119e0780?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&page=1&perPage=1`;
    const r2 = await fetch(moisUrl);
    const t2 = await r2.text();
    console.log(`[MOIS_API (BAEK)] ok: ${r2.ok}, status: ${r2.status}`);
    console.log(`[MOIS_API (BAEK)] Raw Output: ${t2.substring(0, 150)}`);
  } catch(e) { console.log(`[MOIS_API (BAEK)] Error: ${e.message}`); }
  
  try {
    const safeUrl = `http://211.237.50.150:7080/openapi/${process.env.PUBLIC_DATA_API_KEY}/json/Grid_20200713000000000605_1/1/1`;
    const r3 = await fetch(safeUrl);
    const t3 = await r3.text();
    console.log(`[SAFE_API] ok: ${r3.ok}, status: ${r3.status}`);
    console.log(`[SAFE_API] Raw Output: ${t3.substring(0, 150)}`);
  } catch(e) { console.log(`[SAFE_API] Error: ${e.message}`); }
}
test();
