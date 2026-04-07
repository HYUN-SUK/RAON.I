import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const MOIS_API_KEY = process.env.PUBLIC_DATA_API_KEY;
const SAFE_API_KEY = process.env.SAFE_RESTAURANT_API_KEY || process.env.PUBLIC_DATA_API_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;

const endpoints = [
  { group: '마트-대규모', url: `http://apis.data.go.kr/1741000/LargeScaleRetailStore/info?serviceKey=${MOIS_API_KEY}&pageNo=1&numOfRows=1&returnType=json&CTPRVN_NM=${encodeURIComponent('충청남도')}` },
  { group: '마트-준대규모', url: `http://apis.data.go.kr/1741000/QuasiWholesaleRetailStore/info?serviceKey=${MOIS_API_KEY}&pageNo=1&numOfRows=1&returnType=json&CTPRVN_NM=${encodeURIComponent('충청남도')}` },
  { group: '마트-기타식품', url: `http://apis.data.go.kr/1741000/OtherFoodSalesInd/info?serviceKey=${MOIS_API_KEY}&pageNo=1&numOfRows=1&returnType=json&CTPRVN_NM=${encodeURIComponent('충청남도')}` },
  { group: '식당-모범', url: `http://apis.data.go.kr/1741000/GoodRestaurantInd/info?serviceKey=${MOIS_API_KEY}&pageNo=1&numOfRows=1&returnType=json&CTPRVN_NM=${encodeURIComponent('충청남도')}` },
  { group: '명소', url: `http://apis.data.go.kr/B551011/KorService1/areaBasedList1?serviceKey=${MOIS_API_KEY}&numOfRows=1&pageNo=1&MobileOS=ETC&MobileApp=RAONAI&_type=json&listYN=Y&arrange=A&areaCode=34&contentTypeId=12` },
  { group: '식당-백년', url: `https://api.odcloud.kr/api/15102255/v1/uddi:6ba7b810-9dad-11d1-80b4-00c04fd430c8?serviceKey=${MOIS_API_KEY}&page=1&perPage=1` },
  { group: '식당-안심', url: `http://211.237.50.150:7080/openapi/${SAFE_API_KEY}/json/Grid_20200713000000000605_1/1/1` }
];

async function testApis() {
  const results = [];
  for (const ep of endpoints) {
    try {
      const start = Date.now();
      const res = await fetch(ep.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
      let text = await res.text();
      let status = res.status;
      let isSuccess = false;
      let errorReason = '';
      
      try {
        const json = JSON.parse(text);
        if (json.response?.header?.resultCode === '00' || json.header?.resultCode === '00' || json.data || json.Grid_20200713000000000605_1) {
          isSuccess = true;
          text = `JSON Parsed successfully (Status: ${status})`;
        } else {
          text = `JSON Parsed but logical error: ${text.substring(0, 100)}`;
          errorReason = json.response?.header?.resultMsg || json.header?.resultMsg || 'Unknown logical error';
        }
      } catch (e) {
        text = `Non-JSON Response (Status: ${status}): ${text.substring(0, 100).replace(/\n/g, ' ')}`;
        errorReason = 'Invalid JSON response (usually blocked by gateway/firewall or service unstable)';
      }

      results.push({
        group: ep.group,
        isSuccess,
        status,
        duration: Date.now() - start,
        preview: text,
        errorReason
      });
    } catch (e) {
      results.push({
        group: ep.group,
        isSuccess: false,
        status: 'FETCH_ERROR',
        duration: -1,
        preview: e.message,
        errorReason: 'Network/Timeout Error'
      });
    }
  }
  
  console.log('----- LOCAL ENVIRONMENT API TEST RESULTS -----');
  console.table(results);
}

testApis();
