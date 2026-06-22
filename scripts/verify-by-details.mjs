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

  console.log("=== [마스터 DB 정밀 정합성 및 분류별 검산 프로그램] ===\n");

  // 1. 테이블 내 모든 category 분포 조회
  console.log("1. master_places 내 활성 category 분포:");
  const { data: catData, error: catErr } = await supabase
    .from('master_places')
    .select('category')
    .eq('is_active', true);
  
  if (catErr) {
    console.error("Category query error:", catErr.message);
  } else {
    const catCounts = {};
    catData.forEach(row => {
      catCounts[row.category] = (catCounts[row.category] || 0) + 1;
    });
    console.table(Object.keys(catCounts).map(cat => ({ Category: cat, Count: catCounts[cat] })));
  }

  // 2. 테이블 내 모든 api_source 분포 조회
  console.log("\n2. master_places 내 활성 api_source 분포:");
  const { data: srcData, error: srcErr } = await supabase
    .from('master_places')
    .select('api_source')
    .eq('is_active', true);

  const srcCounts = {};
  if (srcErr) {
    console.error("Source query error:", srcErr.message);
  } else {
    srcData.forEach(row => {
      srcCounts[row.api_source] = (srcCounts[row.api_source] || 0) + 1;
    });
    console.table(Object.keys(srcCounts).map(src => ({ Source: src, Count: srcCounts[src] })));
  }

  // 3. 식당/카페 인증별 상세 수량 검산 (백년가게, lx인증, 안심식당, 모범식당)
  console.log("\n3. 식당/카페 인증별 적재 상세 검산:");
  
  // lx인증 api_source 키를 찾기 위해 srcCounts에 'LX'가 포함되어 있는지 매핑
  const lxSourceKey = Object.keys(srcCounts).find(k => k.includes('LX') || k.includes('CERTIFIED') || k.includes('SEED_LX')) || 'LX_RESTAURANT';
  
  const restaurantSources = [
    { label: '백년가게', key: 'SMBA_BAEK' },
    { label: '모범음식점', key: 'MOIS_GOOD_RESTAURANT' },
    { label: '안심식당', key: 'SAFE_REST' },
    { label: '안심식당(ALT)', key: 'SAFE_RESTAURANT' },
    { label: 'LX인증식당', key: lxSourceKey }
  ];

  const restReport = [];
  for (const src of restaurantSources) {
    // 해당 api_source의 전체 활성 수량
    const { count: total } = await supabase
      .from('master_places')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('api_source', src.key);

    if (total === 0) continue; // 데이터가 아예 없는 source는 생략

    // 해당 api_source의 상세정보 적재(enriched=true) 수량
    const { count: enriched } = await supabase
      .from('master_places')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('api_source', src.key)
      .eq('raw_data->enriched', true);

    restReport.push({
      '인증 종류': src.label,
      'API Source': src.key,
      '전체 데이터 수량': total || 0,
      '상세정보 적재 완료': enriched || 0,
      '미적재 수량': (total || 0) - (enriched || 0),
      '적재 완비율': total > 0 ? ((enriched / total) * 100).toFixed(2) + '%' : '0%'
    });
  }
  console.table(restReport);

  // 4. 마트 규모별 상세 수량 검산 (대형마트, 준대규모, 기타식품판매업)
  console.log("\n4. 마트 규모별 적재 상세 검산:");
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
      .eq('api_source', src.key);

    if (total === 0) continue;

    const { count: enriched } = await supabase
      .from('master_places')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
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

  process.exit(0);
}

run();
