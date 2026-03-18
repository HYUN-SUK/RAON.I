import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
const now = new Date();
const baseTime = now.getHours() < 6 ? '1800' : '0600'; // 중기예보는 06시, 18시

const API_CONFIGS = [
  // 정적데이터 주간배치 (Gold Standard: LocalData & ODCloud)
  { name: 'MART_LOCALDATA', label: '마트(LocalData)', url: 'https://www.localdata.go.kr/datafile/each/08_25_01_P_CSV.zip' },
  { name: 'REST_LOCALDATA', label: '식당(모범음식점)', url: 'https://www.localdata.go.kr/datafile/etc/LOCALDATA_ALL_12_03_01_E.xlsx' },
  { name: 'REST_BAEK', label: '식당(백년가게)', url: `https://api.odcloud.kr/api/15102255/v1/uddi:c8c0f585-8ee0-47a3-8686-3507119e0780?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&page=1&perPage=1` },
  { name: 'REST_SAFE', label: '식당(안심식당)', url: `http://211.237.50.150:7080/openapi/${process.env.SAFE_RESTAURANT_API_KEY}/json/Grid_20200713000000000605_1/1/1` },
  { name: 'TOUR_SPOT', label: '관광명소(TourAPI)', url: `http://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&numOfRows=1&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&listYN=Y&arrange=A&contentTypeId=12` },
  
  // 동적데이터 3일전 캐싱
  { name: 'FESTIVAL', label: '축제(TourAPI)', url: `http://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&numOfRows=1&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&listYN=Y&arrange=A&eventStartDate=${today}` },
  { name: 'HOSPITAL', label: '병원(NMC)', url: `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&STAGE1=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C&STAGE2=%EA%B0%95%EB%82%A8%EA%B5%AC&_type=json` },
  { name: 'GAS_OPINET', label: '주유소(오피넷)', url: `http://www.opinet.co.kr/api/aroundAll.do?code=${process.env.OPINET_API_KEY}&x=314688&y=544837&radius=1000&sort=1&prodcd=C004&out=json` },
  
  // 실시간 API
  { name: 'WEATHER_SHORT', label: '날씨(단기)', url: `http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${process.env.KMA_SERVICE_KEY}&numOfRows=10&pageNo=1&base_date=${today}&base_time=0500&nx=55&ny=127&_type=json` },
  { name: 'WEATHER_MID', label: '날씨(중기)', url: `http://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst?serviceKey=${process.env.KMA_SERVICE_KEY}&numOfRows=1&pageNo=1&regId=11C20000&tmFc=${today}${baseTime}&_type=json` },
  { name: 'KAKAO_LOCAL', label: '카카오로컬', url: 'https://dapi.kakao.com/v2/local/search/keyword.json?query=%ED%80%B4%ED%82%A4', headers: { 'Authorization': `KakaoAK ${process.env.KAKAO_REST_API_KEY}` } },
  { name: 'KAKAO_MAP', label: '카카오맵', url: 'https://dapi.kakao.com/v2/local/search/address.json?query=%EC%84%9C%EC%9A%B8', headers: { 'Authorization': `KakaoAK ${process.env.KAKAO_REST_API_KEY}` } },
  { name: 'GOCAMPING', label: '고캠핑', url: `http://apis.data.go.kr/B551011/GoCamping/basedList?serviceKey=${process.env.GOCAMPING_API_KEY}&numOfRows=1&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json` },
  { name: 'GEMINI', label: 'AI(제미나이)', url: `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`, method: 'POST', body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] }) }
];

async function getLatestOdcloudPath(namespace = "15102255/v1") {
  try {
    const specUrl = `https://infuser.odcloud.kr/oas/docs?namespace=${encodeURIComponent(namespace)}`;
    const response = await fetch(specUrl, { timeout: 5000 });
    const spec = await response.json();
    const paths = Object.keys(spec.paths || {});
    if (!paths.length) return null;
    return paths[0]; 
  } catch (e) {
    console.error('Swagger Discovery Failed:', e.message);
    return null;
  }
}

async function checkHealth() {
  console.log('🚀 Starting API Health Check...');
  const startTime = Date.now();
  const apiStatus = [];

  // [Dynamic Discovery] 백년가게 최신 경로 확보
  const baekPath = await getLatestOdcloudPath("15102255/v1");
  if (baekPath) {
    const baekIdx = API_CONFIGS.findIndex(c => c.name === 'REST_BAEK');
    if (baekIdx !== -1) {
      API_CONFIGS[baekIdx].url = `https://api.odcloud.kr/api${baekPath}?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&page=1&perPage=1`;
      console.log(`[DISCOVERY] REST_BAEK updated with latest path: ${baekPath}`);
    }
  }

  // [Parallel Execution] 모든 API를 동시에 점검하여 속도 향상 (타임아웃 방지)
  const results = await Promise.all(API_CONFIGS.map(async (api) => {
    const apiStartTime = Date.now();
    try {
      const response = await fetch(api.url, {
        method: api.method || 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          ...(api.headers || {}),
          ...(api.method === 'POST' ? { 'Content-Type': 'application/json' } : {})
        },
        body: api.body,
        timeout: 10000
      });

      const duration = Date.now() - apiStartTime;
      const isOk = response.ok;
      let errorDetail = '';
      
      if (!isOk) {
        errorDetail = `HTTP ${response.status}: ${response.statusText}`;
      }

      // 특별 처리: Gemini는 실패하더라도 조치 보류 (기포함)
      if (api.name === 'GEMINI' && !isOk) {
        return {
          name: api.name,
          label: api.label,
          status: 'FAILURE',
          duration_ms: duration,
          error: `HTTP ${response.status} (Deferred)`,
          checked_at: new Date().toISOString()
        };
      }

      return {
        name: api.name,
        label: api.label,
        status: isOk ? 'SUCCESS' : 'FAILURE',
        duration_ms: duration,
        error: errorDetail,
        checked_at: new Date().toISOString()
      };
    } catch (error) {
      return {
        name: api.name,
        label: api.label,
        status: 'FAILURE',
        duration_ms: Date.now() - apiStartTime,
        error: error.message,
        checked_at: new Date().toISOString()
      };
    }
  }));

  results.forEach(res => {
    console.log(`[${res.status === 'SUCCESS' ? 'OK' : 'FAIL'}] ${res.label} (${res.duration_ms}ms)`);
    apiStatus.push(res);
  });

  const { error } = await supabase.from('automation_logs').insert({
    job_name: 'API_HEALTH_CHECK',
    status: apiStatus.every(s => s.status === 'SUCCESS' || s.name === 'GEMINI') ? 'SUCCESS' : 'PARTIAL_FAILURE',
    processed_count: apiStatus.length,
    message: `전체 ${apiStatus.length}개 API 중 ${apiStatus.filter(s => s.status === 'SUCCESS').length}개 정상`,
    duration_ms: Date.now() - startTime,
    api_status: apiStatus
  });

  if (error) {
    console.error('Failed to log results to DB:', error);
  }

  // FE에서 즉각 파싱할 수 있도록 결과 JSON을 출력
  console.log('JSON_RESULT_START');
  console.log(JSON.stringify(apiStatus));
  console.log('JSON_RESULT_END');
}

checkHealth();
