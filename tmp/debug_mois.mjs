import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PUBLIC_KEY = process.env.PUBLIC_DATA_API_KEY;

async function debugMois(apiType, url) {
  console.log(`\n--- Debugging MOIS [${apiType}] ---`);
  console.log(`URL: ${url.replace(PUBLIC_KEY, 'REDACTED')}`);
  
  try {
    const res = await fetch(url);
    const status = res.status;
    const body = await res.text();
    
    console.log(`Status: ${status}`);
    console.log(`Body Fragment: ${body.substring(0, 500)}`);
    
    if (body.includes('<returnAuthMsg>')) {
      console.log('Authentication Error Detected!');
    } else if (body.includes('SERVICE_ERROR')) {
      console.log('System Service Error Detected!');
    }
  } catch (err) {
    console.error(`Fetch Error: ${err.message}`);
  }
}

async function run() {
  // 1. 대규모점포
  const martUrl = `http://localdata.go.kr/openapi/service/rest/Localdata010101/getOpnByGubun01?serviceKey=${PUBLIC_KEY}&pageNo=1&numOfRows=10&authKey=A&localCode=3000000`;
  await debugMois('MART', martUrl);

  // 2. 모범음식점
  const restUrl = `http://localdata.go.kr/openapi/service/rest/Localdata010101/getOpnByGubun03?serviceKey=${PUBLIC_KEY}&pageNo=1&numOfRows=10&localCode=3000000`;
  await debugMois('REST', restUrl);
}

run();
