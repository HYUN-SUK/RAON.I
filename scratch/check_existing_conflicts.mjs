import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function checkExistingReservationsIntegrity() {
  console.log('=== [기존 전체 예약 데이터 무결성 사전 전수 검사] ===\n');

  const { data: allRes, error } = await supabase
    .from('reservations')
    .select('id, site_id, check_in_date, check_out_date, status, guest_name')
    .not('status', 'in', '("CANCELLED","REFUNDED")');

  if (error) {
    console.error('조회 실패:', error);
    return;
  }

  console.log(`현재 DB 내 활성(CANCELLED 제외) 예약 총 건수: ${allRes?.length || 0}건`);

  // 겹치는 예약이 있는지 전수 2중 루프 검사
  let conflictCount = 0;
  for (let i = 0; i < (allRes?.length || 0); i++) {
    for (let j = i + 1; j < (allRes?.length || 0); j++) {
      const r1 = allRes[i];
      const r2 = allRes[j];

      if (r1.site_id === r2.site_id) {
        const r1In = new Date(r1.check_in_date);
        const r1Out = new Date(r1.check_out_date);
        const r2In = new Date(r2.check_in_date);
        const r2Out = new Date(r2.check_out_date);

        // 겹침 조건
        if (r1In < r2Out && r1Out > r2In) {
          console.warn(`⚠️ 기존 데이터 충돌 발견! [${r1.site_id}] ${r1.check_in_date}~${r1.check_out_date}(${r1.guest_name}) vs ${r2.check_in_date}~${r2.check_out_date}(${r2.guest_name})`);
          conflictCount++;
        }
      }
    }
  }

  if (conflictCount === 0) {
    console.log('🎉 [검증 완료] 기존 DB에 겹치는 데이터가 0건이므로, 제약조건이 에러 없이 100% 안전하게 추가됩니다!');
  } else {
    console.log(`총 ${conflictCount}건의 기존 충돌 데이터 발견`);
  }
}

checkExistingReservationsIntegrity();
