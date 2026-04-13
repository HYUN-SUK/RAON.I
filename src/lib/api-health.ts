import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ApiStatus {
  name: string;
  label: string;
  status: 'SUCCESS' | 'FAILURE' | 'PENDING';
  duration_ms: number;
  error?: string;
  checked_at?: string;
}

export const getApiConfigs = () => {
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const now = new Date();
  const baseTime = now.getHours() < 6 ? '1800' : '0600';

  return [
    { name: 'MART_LARGE', label: '마트(대형마트)', url: 'https://www.localdata.go.kr/datafile/each/08_25_01_P_CSV.zip' },
    { name: 'MART_SSM', label: '마트(준대규모)', url: 'https://www.localdata.go.kr/datafile/each/08_24_01_P_CSV.zip' },
    { name: 'MART_SUPER', label: '마트(기타식품)', url: 'https://www.localdata.go.kr/datafile/each/07_22_13_P_CSV.zip' },
    { name: 'REST_LOCALDATA', label: '식당(모범음식점)', url: 'https://www.localdata.go.kr/datafile/etc/LOCALDATA_ALL_12_03_01_E.xlsx' },
    { name: 'REST_BAEK', label: '식당(백년가게)', url: `https://api.odcloud.kr/api/15102255/v1/uddi:c8c0f585-8ee0-47a3-8686-3507119e0780?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&page=1&perPage=1` },
    { name: 'REST_SAFE', label: '식당(안심식당)', url: `http://211.237.50.150:7080/openapi/${process.env.SAFE_RESTAURANT_API_KEY}/json/Grid_20200713000000000605_1/1/1` },
    { name: 'LX_RESTAURANT', label: '식당(LX공사맛집)', url: 'https://www.lx.or.kr/lx/index.do' },
    { name: 'TOUR_SPOT', label: '관광명소(TourAPI)', url: `http://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&numOfRows=1&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&listYN=Y&arrange=A&contentTypeId=12` },
    { name: 'FESTIVAL', label: '축제(TourAPI)', url: `http://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&numOfRows=1&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&listYN=Y&arrange=A&eventStartDate=${today}` },
    { name: 'HOSPITAL', label: '병원(NMC)', url: `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&STAGE1=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C&STAGE2=%EA%B0%95%EB%82%A8%EA%B5%AC&_type=json` },
    { name: 'GAS_OPINET', label: '주유소(오피넷)', url: `http://www.opinet.co.kr/api/aroundAll.do?code=${process.env.OPINET_API_KEY}&x=314688&y=544837&radius=1000&sort=1&prodcd=C004&out=json` },
    { name: 'WEATHER_SHORT', label: '날씨(단기)', url: `http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${process.env.KMA_SERVICE_KEY}&numOfRows=10&pageNo=1&base_date=${today}&base_time=0500&nx=55&ny=127&_type=json` },
    { name: 'WEATHER_MID', label: '날씨(중기)', url: `http://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst?serviceKey=${process.env.KMA_SERVICE_KEY}&numOfRows=1&pageNo=1&regId=11C20000&tmFc=${today}${baseTime}&_type=json` },
    { name: 'KAKAO_LOCAL', label: '카카오로컬', url: 'https://dapi.kakao.com/v2/local/search/keyword.json?query=%ED%80%B4%ED%82%A4', headers: { 'Authorization': `KakaoAK ${process.env.KAKAO_REST_API_KEY}` } },
    { name: 'KAKAO_MAP', label: '카카오맵', url: 'https://dapi.kakao.com/v2/local/search/address.json?query=%EC%84%9C%EC%9A%B8', headers: { 'Authorization': `KakaoAK ${process.env.KAKAO_REST_API_KEY}` } },
    { name: 'GOCAMPING', label: '고캠핑', url: `http://apis.data.go.kr/B551011/GoCamping/basedList?serviceKey=${process.env.GOCAMPING_API_KEY}&numOfRows=1&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json` },
    { name: 'SPOT_TMAP_REL', label: '명소 연관(Tmap)', url: `http://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&areaCd=11&signguCd=11110&baseYm=202403&numOfRows=1&_type=json&MobileOS=ETC&MobileApp=AppTest` },
    { name: 'SPOT_KT_CONCTR', label: '명소 집중률(KT)', url: `http://apis.data.go.kr/B551011/TatsCnctrRateService/tatsCnctrRatedList?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&areaCd=11&signguCd=11110&numOfRows=1&_type=json&MobileOS=ETC&MobileApp=AppTest` },
    { name: 'GEMINI', label: 'AI(제미나이)', url: `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`, method: 'POST', body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] }) }
  ];
};

async function getLatestOdcloudPath(namespace = "15102255/v1") {
  try {
    const specUrl = `https://infuser.odcloud.kr/oas/docs?namespace=${encodeURIComponent(namespace)}`;
    const response = await fetch(specUrl, { signal: AbortSignal.timeout(5000) });
    const spec = await response.json();
    const paths = Object.keys(spec.paths || {});
    if (!paths.length) return null;
    return paths[0]; 
  } catch (e: any) {
    console.error('Swagger Discovery Failed:', e.message);
    return null;
  }
}

export async function performHealthCheck() {
  const startTime = Date.now();
  const apiConfigs = getApiConfigs();
  
  // [Dynamic Discovery] 백년가게 최신 경로 확보
  const baekPath = await getLatestOdcloudPath("15102255/v1");
  if (baekPath) {
    const baekIdx = apiConfigs.findIndex(c => c.name === 'REST_BAEK');
    if (baekIdx !== -1) {
      apiConfigs[baekIdx].url = `https://api.odcloud.kr/api${baekPath}?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&page=1&perPage=1`;
    }
  }

  const results: ApiStatus[] = await Promise.all(apiConfigs.map(async (api): Promise<ApiStatus> => {
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
        signal: AbortSignal.timeout(10000)
      } as any);

      const duration = Date.now() - apiStartTime;
      const isOk = response.ok;
      
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
        error: isOk ? '' : `HTTP ${response.status}: ${response.statusText}`,
        checked_at: new Date().toISOString()
      };
    } catch (error: any) {
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

  // DB 로그 기록
  try {
    await supabase.from('automation_logs').insert({
      job_name: 'API_HEALTH_CHECK',
      status: results.every(s => s.status === 'SUCCESS' || s.name === 'GEMINI') ? 'SUCCESS' : 'PARTIAL_FAILURE',
      processed_count: results.length,
      message: `전체 ${results.length}개 API 중 ${results.filter(s => s.status === 'SUCCESS').length}개 정상`,
      duration_ms: Date.now() - startTime,
      api_status: results
    });
  } catch (dbError) {
    console.error('Failed to log results to DB:', dbError);
  }

  return results;
}
