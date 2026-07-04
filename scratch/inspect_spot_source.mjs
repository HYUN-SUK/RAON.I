import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function inspectSpot() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const reservationId = '7e3a4339-72ea-4f9a-87af-adf031b57bf6';
  console.log(`=== 예약 [${reservationId}] Candidates 내 명소 마스터 레코드 정밀 검사 ===`);

  // 1. candidates 데이터 먼저 긁어옴
  const { data: cands } = await supabase
    .from('smart_plan_candidates')
    .select('*')
    .eq('reservation_id', reservationId);

  const spotCands = cands?.filter(c => c.category === 'SPOT' || c.category === 'ROUTE_SPOT') || [];
  const factIds = spotCands.map(c => c.fact_id).filter(Boolean);

  if (factIds.length === 0) {
    console.log("명소 후보군이 비어 있습니다.");
    return;
  }

  // 2. PK 인덱스를 사용하여 마스터 테이블에서 초고속 조회
  const { data: places, error } = await supabase
    .from('master_places')
    .select('id, name, address, api_source, raw_data')
    .in('id', factIds);

  if (error) {
    console.error("마스터 조회 에러:", error.message);
    return;
  }

  console.log(`- 수집된 명소 마스터 레코드 수: ${places?.length || 0} 건`);

  // 이름별로 그룹화하여 출력
  const grouped = {};
  places.forEach(p => {
    if (!grouped[p.name]) grouped[p.name] = [];
    grouped[p.name].push(p);
  });

  Object.entries(grouped).forEach(([name, list]) => {
    console.log(`\n* 장소명: "${name}" (총 ${list.length}개 레코드 발견)`);
    list.forEach((p, i) => {
      console.log(`  [${i+1}] ID: ${p.id}`);
      console.log(`      주소: "${p.address}"`);
      console.log(`      출처 (api_source): "${p.api_source || ''}"`);
      console.log(`      raw_data:`, JSON.stringify(p.raw_data));
    });
  });
}

inspectSpot();
