import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PUBLIC_KEY = process.env.PUBLIC_DATA_API_KEY;

async function debugMoisFormats(apiType, baseUrl) {
  console.log(`\n--- Debugging MOIS [${apiType}] Formats ---`);
  
  const formats = ['json', 'xml'];
  for (const fmt of formats) {
    const url = `${baseUrl}&type=${fmt}`;
    console.log(`Testing ${fmt} at: ${url.replace(PUBLIC_KEY, 'REDACTED')}`);
    try {
      const res = await fetch(url);
      const body = await res.text();
      console.log(`[${fmt}] Status: ${res.status}`);
      console.log(`[${fmt}] Body Start: ${body.substring(0, 200)}`);
      if (res.status === 200 && !body.includes('Unexpected errors')) {
        console.log(`✅ [${fmt}] SUCCESS!`);
      }
    } catch (err) {
      console.log(`[${fmt}] Fetch Error: ${err.message}`);
    }
  }
}

async function run() {
  // 대규모점포 (Daejeon code 3000000)
  const martBase = `http://localdata.go.kr/openapi/service/rest/Localdata010101/getOpnByGubun01?serviceKey=${PUBLIC_KEY}&pageNo=1&numOfRows=10&authKey=A&localCode=3000000`;
  await debugMoisFormats('MART', martBase);

  // 모범음식점 (Daejeon code 3000000)
  const restBase = `http://localdata.go.kr/openapi/service/rest/Localdata010101/getOpnByGubun03?serviceKey=${PUBLIC_KEY}&pageNo=1&numOfRows=10&localCode=3000000`;
  await debugMoisFormats('REST', restBase);
  
  // Try without localCode
  const globalMart = `http://localdata.go.kr/openapi/service/rest/Localdata010101/getOpnByGubun01?serviceKey=${PUBLIC_KEY}&pageNo=1&numOfRows=10&authKey=A`;
  await debugMoisFormats('GLOBAL_MART', globalMart);
}

run();
