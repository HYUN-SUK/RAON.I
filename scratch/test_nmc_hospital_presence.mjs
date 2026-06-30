import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;

if (!PUBLIC_API_KEY) {
  console.error("Missing PUBLIC_DATA_API_KEY");
  process.exit(1);
}

const targetHospitals = [
  { name: '건양대학교병원', sido: '대전광역시' },
  { name: '대전을지대학교병원', sido: '대전광역시' },
  { name: '을지대학교병원', sido: '대전광역시' },
  { name: '엔케이세종병원', sido: '세종특별자치시' },
  { name: '홍성한국병원', sido: '충청남도' },
  { name: '한국병원', sido: '충청남도' }
];

async function checkNmcApi() {
  console.log("=== Querying NMC Hospital Info API (getHsptlMdcncListInfoInqire) ===");

  for (const hosp of targetHospitals) {
    try {
      // QN(기관명) 파라미터로 검색
      const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEgytListInfoInqire?serviceKey=${PUBLIC_API_KEY}&QN=${encodeURIComponent(hosp.name)}&pageNo=1&numOfRows=10&_type=json`;
      
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) {
        console.error(`  [ERROR] HTTP error for ${hosp.name}: ${res.status}`);
        continue;
      }

      const data = await res.json();
      const items = data.response?.body?.items?.item;

      if (items) {
        const list = Array.isArray(items) ? items : [items];
        console.log(`\n🏥 Results for "${hosp.name}" (Count: ${list.length}):`);
        list.forEach((item, idx) => {
          console.log(`  [${idx+1}] dutyName: "${item.dutyName}" | HPID: ${item.hpid} | Address: ${item.dutyAddr} | Tel: ${item.dutyTel1}`);
        });
      } else {
        console.log(`\n❌ No results for "${hosp.name}"`);
      }
    } catch (e) {
      console.error(`  [ERROR] Failed to query ${hosp.name}: ${e.message}`);
    }
    // 0.2초 대기
    await new Promise(r => setTimeout(r, 200));
  }
}

checkNmcApi();
