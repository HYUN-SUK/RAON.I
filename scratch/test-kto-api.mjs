import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const API_KEY = process.env.PUBLIC_DATA_API_KEY;
// 기초지자체 중심 관광지 정보 (티맵 검색순위 등) 후보 엔드포인트 2 (TarService)
// [v12.0] 2026-01-12 변경 규격 적용 (법정동 코드 lDongRegnCd, lDongSignguCd 사용)
const URL = `http://apis.data.go.kr/B551011/TarService/getAreaBasedSyncList?serviceKey=${API_KEY}&numOfRows=10&pageNo=1&MobileOS=ETC&MobileApp=RAONAI&_type=json&baseYm=202403&lDongRegnCd=11&lDongSignguCd=11110`;

async function testApi() {
  console.log('Testing KTO DataLab Service...');
  try {
    const res = await fetch(URL);
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Sample Data Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error fetching API:', e.message);
  }
}

testApi();
