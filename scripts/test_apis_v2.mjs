import dotenv from 'dotenv';
import fetch from 'node-fetch';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const MOIS_API_KEY = process.env.PUBLIC_DATA_API_KEY;
const SAFE_API_KEY = process.env.SAFE_RESTAURANT_API_KEY || process.env.PUBLIC_DATA_API_KEY;

const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
console.log(`[TEST] KST Time: ${kstNow.toISOString()}`);

const endpoints = [
  { group: '마트-대규모', url: `http://apis.data.go.kr/1741000/LargeScaleRetailStore/info?serviceKey=${MOIS_API_KEY}&pageNo=1&numOfRows=1&returnType=json&CTPRVN_NM=${encodeURIComponent('충청북도')}` },
  { group: '마트-SSM', url: `http://apis.data.go.kr/1741000/QuasiWholesaleRetailStore/info?serviceKey=${MOIS_API_KEY}&pageNo=1&numOfRows=1&returnType=json&CTPRVN_NM=${encodeURIComponent('충청북도')}` },
  { group: '마트-기타식품', url: `http://apis.data.go.kr/1741000/OtherFoodSalesInd/info?serviceKey=${MOIS_API_KEY}&pageNo=1&numOfRows=1&returnType=json&CTPRVN_NM=${encodeURIComponent('충청북도')}` },
  { group: '식당-모범', url: `http://apis.data.go.kr/1741000/GoodRestaurantInd/info?serviceKey=${MOIS_API_KEY}&pageNo=1&numOfRows=1&returnType=json&CTPRVN_NM=${encodeURIComponent('충청북도')}` },
  { group: '명소(TourAPI v2)', url: `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${MOIS_API_KEY}&numOfRows=1&pageNo=1&MobileOS=ETC&MobileApp=RAONAI&_type=json&listYN=Y&arrange=A&areaCode=34&contentTypeId=12` },
  { group: '식당-안심', url: `http://211.237.50.150:7080/openapi/${SAFE_API_KEY}/json/Grid_20200713000000000605_1/1/1` }
];

async function testApis() {
  const results = [];
  
  // 1. 일반 API 테스트
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 });
      let text = await res.text();
      let status = res.status;
      let isSuccess = false;
      let errorReason = '';
      
      try {
        const json = JSON.parse(text);
        if (json.response?.header?.resultCode === '00' || json.header?.resultCode === '00' || json.Grid_20200713000000000605_1) {
          isSuccess = true;
          text = `✅ Success: JSON Parsed (Status: ${status})`;
          errorReason = '-';
        } else {
          text = `❌ Logical Error: ${text.substring(0, 50)}`;
          errorReason = json.response?.header?.resultMsg || json.header?.resultMsg || 'Unknown logical error';
        }
      } catch (e) {
        text = `❌ Broken/HTML (Status: ${status}): ${text.substring(0, 50).replace(/\n/g, ' ')}`;
        errorReason = 'Gateway failure / Invalid JSON (Usually block or unstable)';
      }

      results.push({
        group: ep.group,
        isSuccess,
        status,
        preview: text,
        errorReason
      });
    } catch (e) {
      results.push({ group: ep.group, isSuccess: false, status: 'TIMEOUT', preview: e.message, errorReason: 'Timeout or Network down' });
    }
  }
  
  // 2. 백년가게 (ODCloud Swagger Test)
  try {
     const swUrl = `https://infuser.odcloud.kr/oas/docs?namespace=${encodeURIComponent('15102255/v1')}`;
     const swRes = await fetch(swUrl);
     const swText = await swRes.text();
     if(swRes.status !== 200) {
         results.push({ group: '식당-백년', isSuccess: false, status: swRes.status, preview: swText.substring(0,50), errorReason: 'Swagger Docs Fail' });
     } else {
         const spec = JSON.parse(swText);
         const paths = Object.keys(spec.paths || {});
         if(paths.length > 0) {
             const actualPath = paths[0];
             const baekUrl = `https://api.odcloud.kr/api${actualPath}?serviceKey=${MOIS_API_KEY}&page=1&perPage=1`;
             const bRes = await fetch(baekUrl);
             const bText = await bRes.text();
             let bOk = false; let err = '-';
             try { 
                 const bJ = JSON.parse(bText); 
                 if(bJ.data) bOk = true; else err = bJ.msg || 'No data array';
             } catch(e) { err = 'Invalid JSON'; }
             results.push({ group: '식당-백년', isSuccess: bOk, status: bRes.status, preview: `Found path: ${actualPath}`, errorReason: err });
         } else {
             results.push({ group: '식당-백년', isSuccess: false, status: 'No Path', preview: '', errorReason: 'ODCloud returned empty paths' });
         }
     }
  } catch(e) {
      results.push({ group: '식당-백년', isSuccess: false, status: 'ERROR', preview: e.message, errorReason: 'ODCloud Swagger Fail' });
  }

  fs.writeFileSync('api_test_v2.json', JSON.stringify(results, null, 2), 'utf8');
}

testApis();
