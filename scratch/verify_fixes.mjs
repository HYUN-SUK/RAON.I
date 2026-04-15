// [v11.9.9] 수정 검증 스크립트 — RPC 성능 + 행정코드 매핑 + D-3 캐싱 수동 실행
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getAdminCodes } from '../scripts/utils/admin-code-mapping.mjs';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log('=== [v11.9.9] 수정 검증 테스트 ===\n');

  // ━━━ 1. RPC 성능 테스트 (바운딩 박스 적용 확인) ━━━
  console.log('━'.repeat(60));
  console.log('🔍 [1] RPC 성능 테스트 — 철수네 좌표 (예산군)');
  console.log('━'.repeat(60));

  const cats = ['RESTAURANT', 'SPOT', 'MART', 'HOSPITAL', 'GAS_STATION', 'FESTIVAL'];
  for (const cat of cats) {
    const start = Date.now();
    const { data, error } = await supabase.rpc('get_master_places_in_radius_v2', {
      target_lat: 36.626909, target_lng: 126.7647868,
      radius_meters: 30000, p_category: cat,
      limit_count: 1000
    });
    const elapsed = Date.now() - start;
    
    if (error) {
      console.log(`  ${cat.padEnd(14)}: ❌ ${error.message} (${elapsed}ms)`);
    } else {
      const emoji = elapsed < 500 ? '🚀' : elapsed < 2000 ? '✅' : '⚠️';
      console.log(`  ${cat.padEnd(14)}: ${emoji} ${(data||[]).length}건 (${elapsed}ms)`);
    }
  }

  // ━━━ 2. 행정코드 매핑 검증 ━━━
  console.log('\n' + '━'.repeat(60));
  console.log('🔍 [2] 행정코드 매핑 검증 — 대구 시군구');
  console.log('━'.repeat(60));

  const testCases = [
    ['대구광역시', '군위군'],
    ['대구광역시', '수성구'],
    ['대구광역시', '달서구'],
    ['충청남도', '예산군'],
    ['경상북도', '안동시'],
    ['전라남도', '순천시'],
    ['인천광역시', '미추홀구'],
  ];

  for (const [sido, sigungu] of testCases) {
    const { areaCd, signguCd } = getAdminCodes(sido, sigungu);
    const status = signguCd ? '✅' : '❌';
    console.log(`  ${status} ${sido} ${sigungu} → areaCd=${areaCd}, signguCd=${signguCd}`);
  }

  console.log('\n✅ 검증 완료');
}

main().catch(console.error);
