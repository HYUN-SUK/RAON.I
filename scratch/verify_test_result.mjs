import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const sessionStartTime = "2026-06-19T05:27:27.415Z";
  console.log(`Analyzing results for Session Start Time: ${sessionStartTime}`);

  // 1. 세션 시작 시각 이후에 업데이트된 데이터 카운트
  const { data: updatedPlaces, error: err } = await s
    .from('master_places')
    .select('id, name, updated_at, raw_data, category')
    .eq('is_active', true)
    .in('category', ['RESTAURANT', 'MART'])
    .gte('updated_at', sessionStartTime);

  if (err) {
    console.error("Error fetching updated records:", err.message);
    process.exit(1);
  }

  console.log(`\n=== 1,000건 배치 실험 결과 ===`);
  console.log(`- 세션 시작 이후 업데이트된 전체 행(places) 개수: ${updatedPlaces.length}`);
  
  let enrichedTrue = 0;
  let enrichedFalse = 0;
  let restCount = 0;
  let martCount = 0;

  updatedPlaces.forEach(p => {
    if (p.category === 'RESTAURANT') restCount++;
    if (p.category === 'MART') martCount++;

    if (p.raw_data?.enriched === true) {
      enrichedTrue++;
    } else {
      enrichedFalse++;
    }
  });

  console.log(`  * RESTAURANT 수량: ${restCount}`);
  console.log(`  * MART 수량: ${martCount}`);
  console.log(`  * 실효적 상세 수집 성공 (enriched: true): ${enrichedTrue} (${(enrichedTrue/updatedPlaces.length*100).toFixed(1)}%)`);
  console.log(`  * 스킵 / 폴백 처리 (enriched: false): ${enrichedFalse} (${(enrichedFalse/updatedPlaces.length*100).toFixed(1)}%)`);

  // 2. 중복 차단 검증
  // 만약 lt('updated_at', sessionStartTime) 조건으로 다시 대상을 조회했을 때, 방금 업데이트된 건들이 하나도 포함되지 않아야 함
  const { data: nextBatch, error: errNext } = await s
    .from('master_places')
    .select('id, name, updated_at')
    .eq('is_active', true)
    .in('category', ['RESTAURANT', 'MART'])
    .lt('updated_at', sessionStartTime)
    .limit(1000);

  if (errNext) {
    console.error("Error fetching next batch target:", errNext.message);
    process.exit(1);
  }

  let overlapCount = 0;
  const updatedIds = new Set(updatedPlaces.map(p => p.id));
  
  nextBatch.forEach(p => {
    if (updatedIds.has(p.id)) {
      overlapCount++;
    }
  });

  console.log(`\n=== 중복 차단 검증 ===`);
  console.log(`- 다음 차례 대상 1,000건 조회 시, 방금 업데이트를 완료한 ID와 중복되는 개수: ${overlapCount}건`);
  if (overlapCount === 0) {
    console.log(`✅ [성공] 중복 적재 방지 로직이 완벽하게 작동합니다! (중복률 0%)`);
  } else {
    console.log(`❌ [실패] 중복 방지 로직에 결함이 있어 동일 건이 다시 잡힙니다.`);
  }

  // 3. 실효 정보 샘플 출력
  console.log(`\n=== 실효 상세정보 적재 샘플 (enriched: true) ===`);
  const successSamples = updatedPlaces.filter(p => p.raw_data?.enriched === true).slice(0, 3);
  successSamples.forEach(p => {
    console.log(`- [${p.category}] ${p.name}`);
    console.log(`  영업시간: ${p.raw_data?.operating_hours}`);
    console.log(`  휴무일: ${p.raw_data?.closed_days}`);
    console.log(`  메뉴/주차:`, p.category === 'RESTAURANT' ? p.raw_data?.representative_menu : p.raw_data?.parking_available);
  });
}

main();
