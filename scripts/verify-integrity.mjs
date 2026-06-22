import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing Supabase credentials");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log("=== [마스터 DB RLS 우회 데이터 정합성 전수 조사] ===");

  // 1. 카테고리별 전수 카운트 (head: true, count: 'exact' 적용하여 타임아웃 0%)
  const categories = ['RESTAURANT', 'ROUTE_CAFE', 'MART', 'SPOT', 'HOSPITAL', 'FESTIVAL', 'GAS_STATION'];
  const catStats = {};
  let totalActiveSum = 0;

  for (const cat of categories) {
    const { count } = await supabase
      .from('master_places')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('category', cat);
    
    catStats[cat] = count || 0;
    totalActiveSum += (count || 0);
  }
  console.log("\n[1] 실제 카테고리별 활성 데이터 전수 카운트:");
  console.table(Object.keys(catStats).map(cat => ({ Category: cat, Count: catStats[cat] })));
  console.log(`총 활성 데이터 합계: ${totalActiveSum} 건`);

  // 2. 식당/카페 인증 종류별 검산
  // RLS 우회를 피하기 위해 raw_data 내부의 고유 규격 필드 존재 유무로 원래 출처(백년가게, 안심식당 등)를 매핑합니다.
  console.log("\n[2] 식당/카페 인증별 정밀 검산 (고유 규격 필드 추적):");

  const restReport = [];

  // A. 백년가게 (raw_data 내에 ' 등록번호' 키가 존재하는 레코드)
  const { count: baekTotal } = await supabase
    .from('master_places')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .eq('category', 'RESTAURANT')
    .not('raw_data->> 등록번호', 'is', null);

  const { count: baekEnriched } = await supabase
    .from('master_places')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .eq('category', 'RESTAURANT')
    .not('raw_data->> 등록번호', 'is', null)
    .eq('raw_data->enriched', true);

  restReport.push({
    '인증 종류': '백년가게 (SMBA_BAEK)',
    '전체 데이터 수량': baekTotal || 0,
    '상세정보 적재 완료': baekEnriched || 0,
    '미적재 수량': (baekTotal || 0) - (baekEnriched || 0),
    '적재 완비율': baekTotal > 0 ? ((baekEnriched / baekTotal) * 100).toFixed(2) + '%' : '0%'
  });

  // B. 모범음식점 (raw_data 내에 '지정번호' 또는 '지정일자' 또는 '관리번호'가 있는 경우. 
  // 여기서는 api_source = 'MOIS_GOOD_RESTAURANT' 로 덮어써지지 않았음을 확인)
  const { count: goodTotal } = await supabase
    .from('master_places')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .eq('category', 'RESTAURANT')
    .eq('api_source', 'MOIS_GOOD_RESTAURANT');

  const { count: goodEnriched } = await supabase
    .from('master_places')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .eq('category', 'RESTAURANT')
    .eq('api_source', 'MOIS_GOOD_RESTAURANT')
    .eq('raw_data->enriched', true);

  restReport.push({
    '인증 종류': '모범음식점 (MOIS_GOOD)',
    '전체 데이터 수량': goodTotal || 0,
    '상세정보 적재 완료': goodEnriched || 0,
    '미적재 수량': (goodTotal || 0) - (goodEnriched || 0),
    '적재 완비율': goodTotal > 0 ? ((goodEnriched / goodTotal) * 100).toFixed(2) + '%' : '0%'
  });

  // C. 안심식당 (raw_data 내에 'RELAX_GUBUN' 또는 안심식당 특유 키가 존재함. api_source = 'SAFE_REST' 또는 'SAFE_RESTAURANT' 였던 데이터)
  // 안심식당은 raw_data에 'RELAX_USE_YN' 이나 'RELAX_ADD_YN' 이 존재함
  const { count: safeTotal } = await supabase
    .from('master_places')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .eq('category', 'RESTAURANT')
    .or("raw_data->>RELAX_USE_YN.not.is.null,api_source.eq.SAFE_REST,api_source.eq.SAFE_RESTAURANT");

  const { count: safeEnriched } = await supabase
    .from('master_places')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .eq('category', 'RESTAURANT')
    .or("raw_data->>RELAX_USE_YN.not.is.null,api_source.eq.SAFE_REST,api_source.eq.SAFE_RESTAURANT")
    .eq('raw_data->enriched', true);

  restReport.push({
    '인증 종류': '안심식당 (SAFE_REST)',
    '전체 데이터 수량': safeTotal || 0,
    '상세정보 적재 완료': safeEnriched || 0,
    '미적재 수량': (safeTotal || 0) - (safeEnriched || 0),
    '적재 완비율': safeTotal > 0 ? ((safeEnriched / safeTotal) * 100).toFixed(2) + '%' : '0%'
  });

  // D. LX인증식당 (api_source = 'LX_RESTAURANT' 또는 'LX_CERTIFIED')
  const { count: lxTotal } = await supabase
    .from('master_places')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .eq('category', 'RESTAURANT')
    .or("api_source.eq.LX_RESTAURANT,api_source.eq.LX_CERTIFIED,raw_data->>api_source.eq.LX_RESTAURANT");

  const { count: lxEnriched } = await supabase
    .from('master_places')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .eq('category', 'RESTAURANT')
    .or("api_source.eq.LX_RESTAURANT,api_source.eq.LX_CERTIFIED,raw_data->>api_source.eq.LX_RESTAURANT")
    .eq('raw_data->enriched', true);

  restReport.push({
    '인증 종류': 'LX인증식당 (LX_CERTIFIED)',
    '전체 데이터 수량': lxTotal || 0,
    '상세정보 적재 완료': lxEnriched || 0,
    '미적재 수량': (lxTotal || 0) - (lxEnriched || 0),
    '적재 완비율': lxTotal > 0 ? ((lxEnriched / lxTotal) * 100).toFixed(2) + '%' : '0%'
  });

  console.table(restReport);

  // 3. 마트 규모별 검산
  console.log("\n[3] 마트 규모별 정밀 검산:");
  const martSources = [
    { label: '대형마트', key: 'LOCALDATA_MART_LARGE' },
    { label: '준대규모(SSM)', key: 'LOCALDATA_MART_SSM' },
    { label: '기타식품판매업', key: 'LOCALDATA_MART_OTHER' },
    { label: '중형슈퍼', key: 'LOCALDATA_MART_SUPER' }
  ];

  const martReport = [];
  for (const src of martSources) {
    const { count: total } = await supabase
      .from('master_places')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('category', 'MART')
      .eq('api_source', src.key);

    const { count: enriched } = await supabase
      .from('master_places')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('category', 'MART')
      .eq('api_source', src.key)
      .eq('raw_data->enriched', true);

    martReport.push({
      '규모 종류': src.label,
      'API Source': src.key,
      '전체 데이터 수량': total || 0,
      '상세정보 적재 완료': enriched || 0,
      '미적재 수량': (total || 0) - (enriched || 0),
      '적재 완비율': total > 0 ? ((enriched / total) * 100).toFixed(2) + '%' : '0%'
    });
  }
  console.table(martReport);

  // 4. api_source가 FAST_BULK_PLAYWRIGHT로 바뀐 총 개수
  const { count: fastBulkCount } = await supabase
    .from('master_places')
    .select('*', { count: 'exact', head: true })
    .eq('api_source', 'FAST_BULK_PLAYWRIGHT');
  console.log(`\n참고: api_source 컬럼이 'FAST_BULK_PLAYWRIGHT'로 업데이트된 총 레코드 수: ${fastBulkCount || 0}건`);

  process.exit(0);
}

run();
