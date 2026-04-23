import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
const baseTime = '0600';

const INITIAL_API_LIST = () => {
  return [
    { name: 'REST_LOCALDATA', label: '식당(모범음식점)', url: 'https://www.localdata.go.kr/datafile/etc/LOCALDATA_ALL_12_03_01_E.xlsx' },
    { name: 'REST_BAEK', label: '식당(백년가게)', url: `https://api.odcloud.kr/api/15102255/v1/uddi:c8c0f585-8ee0-47a3-8686-3507119e0780?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&page=1&perPage=1` },
    { name: 'REST_SAFE', label: '식당(안심식당)', url: `http://211.237.50.150:7080/openapi/${process.env.SAFE_RESTAURANT_API_KEY}/json/Grid_20200713000000000605_1/1/1` },
    { name: 'LX_RESTAURANT', label: '식당(LX공사맛집)', url: 'https://www.lx.or.kr/lx/index.do' },
    { name: 'TOUR_SPOT', label: '관광명소(TourAPI)', url: `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&numOfRows=1&pageNo=1&MobileOS=ETC&MobileApp=RAONAI&_type=json&listYN=Y&arrange=A&contentTypeId=12` },
    { name: 'FESTIVAL', label: '축제(TourAPI)', url: `https://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&numOfRows=1&pageNo=1&MobileOS=ETC&MobileApp=RAONAI&_type=json&listYN=Y&arrange=A&eventStartDate=${today}` },
    { name: 'HOSPITAL', label: '병원(NMC)', url: `https://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&STAGE1=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C&STAGE2=%EA%B0%95%EB%82%A8%EA%B5%AC&_type=json` },
    { name: 'GAS_OPINET', label: '주유소(오피넷)', url: `http://www.opinet.co.kr/api/aroundAll.do?code=${process.env.OPINET_API_KEY}&x=314688&y=544837&radius=1000&sort=1&prodcd=C004&out=json` },
    { name: 'WEATHER_SHORT', label: '날씨(단기)', url: `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${process.env.KMA_SERVICE_KEY}&numOfRows=10&pageNo=1&base_date=${today}&base_time=0500&nx=55&ny=127&_type=json` },
    { name: 'WEATHER_MID', label: '날씨(중기)', url: `https://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst?serviceKey=${process.env.KMA_SERVICE_KEY}&numOfRows=1&pageNo=1&regId=11C20000&tmFc=${today}${baseTime}&_type=json` },
    { name: 'KAKAO_LOCAL', label: '카카오로컬', url: 'https://dapi.kakao.com/v2/local/search/keyword.json?query=%ED%80%B4%ED%82%A4', headers: { 'Authorization': `KakaoAK ${process.env.KAKAO_REST_API_KEY}` } },
    { name: 'KAKAO_MAP', label: '카카오맵', url: 'https://dapi.kakao.com/v2/local/search/address.json?query=%EC%84%9C%EC%9A%B8', headers: { 'Authorization': `KakaoAK ${process.env.KAKAO_REST_API_KEY}` } },
    { name: 'GOCAMPING', label: '고캠핑', url: `https://apis.data.go.kr/B551011/GoCamping/basedList?serviceKey=${process.env.GOCAMPING_API_KEY}&numOfRows=1&pageNo=1&MobileOS=ETC&MobileApp=RAONAI&_type=json` },
    { name: 'SPOT_TMAP_REL', label: '명소 연관(Tmap)', url: `https://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&areaCd=11&signguCd=11110&baseYm=202504&numOfRows=1&_type=json&MobileOS=ETC&MobileApp=RAONAI` },
    { name: 'SPOT_KT_CONCTR', label: '명소 집중률(KT)', url: `https://apis.data.go.kr/B551011/TatsCnctrRateService/tatsCnctrRatedList?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&areaCd=11&signguCd=11110&numOfRows=1&_type=json&MobileOS=ETC&MobileApp=RAONAI` },
    { name: 'KTO_POPULARITY', label: '관광명소(지자체 인기도)', url: `https://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&areaCd=34&signguCd=34330&baseYm=202504&numOfRows=1&_type=json&MobileOS=ETC&MobileApp=RAONAI` },
    { name: 'GEMINI', label: 'AI(제미나이)', url: `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`, method: 'POST', body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] }) }
  ];
};

async function performHealthCheck() {
  console.log('🚀 API Health Check Started...');
  const results = [];
  const list = INITIAL_API_LIST();

  for (const api of list) {
    try {
      const start = Date.now();
      const res = await fetch(api.url, { 
        method: api.method || 'GET', 
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.data.go.kr/',
          ...(api.headers || {})
        },
        body: api.body ? api.body : undefined 
      });
      const end = Date.now();
      
      const status = res.ok ? 'OK' : 'ERROR';
      console.log(`[${status}] ${api.label} (${end - start}ms) - Status: ${res.status}`);
      results.push({ name: api.name, status, statusCode: res.status, duration: end - start });
    } catch (e) {
      console.log(`[ERROR] ${api.label} - ${e.message}`);
      results.push({ name: api.name, status: 'ERROR', statusCode: 0, duration: 0 });
    }
  }

  console.log('\n--- Final Summary ---');
  results.forEach(r => {
    console.log(`${r.name}: ${r.status} (${r.statusCode})`);
  });
}

performHealthCheck();
