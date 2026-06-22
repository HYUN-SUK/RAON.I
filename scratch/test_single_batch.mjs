import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'child_process';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const sessionStartTime = new Date().toISOString();
  console.log(`[TEST START] Generated Session Start Time: ${sessionStartTime}`);

  // 1. 먼저 이 세션 타임스탬프 이전에 최종 업데이트된 타겟 1,000건의 ID 목록을 조회해 둡니다.
  const { data: beforePlaces, error: errBefore } = await s
    .from('master_places')
    .select('id, name')
    .eq('is_active', true)
    .in('category', ['RESTAURANT', 'MART'])
    .lt('updated_at', sessionStartTime)
    .limit(1000);

  if (errBefore) {
    console.error("Error fetching places before test:", errBefore.message);
    process.exit(1);
  }

  const beforeIds = beforePlaces.map(p => p.id);
  console.log(`Fetched target 1000 places to enrich. Sample first: ${beforePlaces[0]?.name}, last: ${beforePlaces[999]?.name}`);

  // 2. fast-bulk-enrich.mjs를 단독 실행하여 1,000건 수집
  console.log(`\n[RUNNING] Executing fast-bulk-enrich.mjs with --limit 1000...`);
  const result = spawnSync('node', [
    'scripts/fast-bulk-enrich.mjs',
    '--limit', '1000',
    '--concurrency', '8',
    '--session-start-time', sessionStartTime
  ], { stdio: 'inherit' });

  if (result.status !== 0) {
    console.error(`\n🚨 Child process failed with status ${result.status}`);
    process.exit(1);
  }
  console.log(`[COMPLETED] fast-bulk-enrich.mjs process completed.`);

  // 3. 적재 결과 검증
  console.log(`\n[VERIFICATION] Querying database to check updated records...`);

  // (A) 방금 가동했던 1,000건의 ID를 기준으로 업데이트 결과 조회
  const { data: afterPlaces, error: errAfter } = await s
    .from('master_places')
    .select('id, name, updated_at, raw_data')
    .in('id', beforeIds);

  if (errAfter) {
    console.error("Error verifying updated places:", errAfter.message);
    process.exit(1);
  }

  let updatedCount = 0;
  let enrichedTrue = 0;
  let enrichedFalse = 0;

  afterPlaces.forEach(p => {
    if (p.updated_at >= sessionStartTime) {
      updatedCount++;
      if (p.raw_data?.enriched === true) {
        enrichedTrue++;
      } else {
        enrichedFalse++;
      }
    }
  });

  console.log(`\n=== 1,000건 배치 실험 결과 ===`);
  console.log(`- 전체 대상 수량: 1000`);
  console.log(`- 실제 updated_at이 세션 시작 시각 이후로 업데이트된 수량: ${updatedCount}`);
  console.log(`  * 실효적 상세 수집 완료 (enriched: true): ${enrichedTrue}`);
  console.log(`  * 스킵 / 폴백 처리 (enriched: false): ${enrichedFalse}`);

  // (B) 중복 적재 회피 여부 최종 검증
  // 세션 타임스탬프 기준으로 다시 대상을 조회했을 때, 방금 업데이트된 건들이 하나도 조회되지 않는지 확인
  const { data: nextBatch, error: errNext } = await s
    .from('master_places')
    .select('id, name')
    .eq('is_active', true)
    .in('category', ['RESTAURANT', 'MART'])
    .lt('updated_at', sessionStartTime)
    .limit(1000);

  if (errNext) {
    console.error("Error fetching next batch places:", errNext.message);
    process.exit(1);
  }

  const nextBatchIds = new Set(nextBatch.map(p => p.id));
  let duplicatedCount = 0;

  beforeIds.forEach(id => {
    if (nextBatchIds.has(id)) {
      duplicatedCount++;
    }
  });

  console.log(`\n=== 중복 차단 검증 ===`);
  console.log(`- 동일한 세션 시작 시각 기준으로 다음 배치 1,000건 조회 시, 이전 배치 대상과 중복되는 ID 수: ${duplicatedCount}건`);
  if (duplicatedCount === 0) {
    console.log(`✅ [성공] 중복 적재 방지 로직이 완벽하게 작동합니다! (중복률 0%)`);
  } else {
    console.log(`❌ [실패] 중복 방지 로직이 정상 작동하지 않습니다. 중복 ID가 존재합니다.`);
  }
}

main();
