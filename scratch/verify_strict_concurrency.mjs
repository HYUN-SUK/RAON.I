import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

const VALID_USER_ID = '23603c80-68f5-4717-a609-8d13f8d5a2f6';

async function runPostMigrationVerification() {
  console.log('====================================================');
  console.log('🚀 [마이그레이션 적용 후] 3대 핵심 동시성 실측 검증');
  console.log('====================================================\n');

  const createdIds = [];

  try {
    // ------------------------------------------------------------------
    // TEST 1: 체크인 날짜가 다른 1일 겹침 2박 동시 타격 (이전 실패 케이스)
    // ------------------------------------------------------------------
    console.log('【TEST 1】 1일 겹침 2박 동시 요청 (A: 10/16~10/18 vs B: 10/17~10/19 on site-1)');
    const [res1A, res1B] = await Promise.all([
      supabase.rpc('create_reservation_safe', {
        p_user_id: VALID_USER_ID,
        p_site_id: 'site-1',
        p_check_in: '2026-10-16',
        p_check_out: '2026-10-18',
        p_total_price: 140000,
        p_guest_name: '테스트_1A',
        p_guest_phone: '010-1111-1111'
      }),
      supabase.rpc('create_reservation_safe', {
        p_user_id: VALID_USER_ID,
        p_site_id: 'site-1',
        p_check_in: '2026-10-17',
        p_check_out: '2026-10-19',
        p_total_price: 140000,
        p_guest_name: '테스트_1B',
        p_guest_phone: '010-2222-2222'
      })
    ]);

    const r1A = res1A.data || {};
    const r1B = res1B.data || {};

    if (r1A.reservation_id) createdIds.push(r1A.reservation_id);
    if (r1B.reservation_id) createdIds.push(r1B.reservation_id);

    console.log('  👉 결과 A:', r1A);
    console.log('  👉 결과 B:', r1B);

    const test1SuccessCount = (r1A.success ? 1 : 0) + (r1B.success ? 1 : 0);
    if (test1SuccessCount === 1) {
      console.log('  🎉 TEST 1 통과! (정확히 1명 성공, 1명 안전 차단)\n');
    } else {
      console.error(`  ❌ TEST 1 실패: 성공 ${test1SuccessCount}건\n`);
    }

    // ------------------------------------------------------------------
    // TEST 2: 퇴실일=입실일 연박 연속 예약 (A: 10/20~10/22 vs B: 10/22~10/24 on site-2)
    // ------------------------------------------------------------------
    console.log('【TEST 2】 퇴실일=입실일 연속 예약 (A: 10/20~10/22 vs B: 10/22~10/24 on site-2)');
    const res2A = await supabase.rpc('create_reservation_safe', {
      p_user_id: VALID_USER_ID,
      p_site_id: 'site-2',
      p_check_in: '2026-10-20',
      p_check_out: '2026-10-22',
      p_total_price: 140000,
      p_guest_name: '테스트_2A',
      p_guest_phone: '010-3333-3333'
    });

    const res2B = await supabase.rpc('create_reservation_safe', {
      p_user_id: VALID_USER_ID,
      p_site_id: 'site-2',
      p_check_in: '2026-10-22',
      p_check_out: '2026-10-24',
      p_total_price: 140000,
      p_guest_name: '테스트_2B',
      p_guest_phone: '010-4444-4444'
    });

    const r2A = res2A.data || {};
    const r2B = res2B.data || {};

    if (r2A.reservation_id) createdIds.push(r2A.reservation_id);
    if (r2B.reservation_id) createdIds.push(r2B.reservation_id);

    console.log('  👉 결과 A (10/20~10/22):', r2A);
    console.log('  👉 결과 B (10/22~10/24):', r2B);

    if (r2A.success && r2B.success) {
      console.log('  🎉 TEST 2 통과! (퇴실일=입실일 겹침 없이 둘 다 정상 예약 완료)\n');
    } else {
      console.error('  ❌ TEST 2 실패: 연박 차단 오류 발생\n');
    }

    // ------------------------------------------------------------------
    // TEST 3: 동일 사이트 10명 동시 타격 (site-3, 10/23~10/25)
    // ------------------------------------------------------------------
    console.log('【TEST 3】 동일 날짜 10인 동시 타격 (10/23~10/25 on site-3)');
    const test3Results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => 
        supabase.rpc('create_reservation_safe', {
          p_user_id: VALID_USER_ID,
          p_site_id: 'site-3',
          p_check_in: '2026-10-23',
          p_check_out: '2026-10-25',
          p_total_price: 140000,
          p_guest_name: `동시타격_${i + 1}`,
          p_guest_phone: `010-5555-${(i + 1).toString().padStart(4, '0')}`
        })
      )
    );

    let test3SuccessCount = 0;
    test3Results.forEach((res, idx) => {
      const data = res.data || {};
      if (data.reservation_id) createdIds.push(data.reservation_id);
      if (data.success) test3SuccessCount++;
      console.log(`  [유저 ${idx + 1}] Status: ${data.success ? '✅ SUCCESS' : '❌ BLOCKED'} | Msg: ${data.message}`);
    });

    if (test3SuccessCount === 1) {
      console.log(`\n  🎉 TEST 3 통과! (10명 중 정확히 1명만 성공, 9명 100% 안전 차단)\n`);
    } else {
      console.error(`\n  ❌ TEST 3 실패: 성공 ${test3SuccessCount}건\n`);
    }

  } finally {
    // ------------------------------------------------------------------
    // 테스트 데이터 100% 즉시 클린업
    // ------------------------------------------------------------------
    if (createdIds.length > 0) {
      console.log(`🧹 테스트 생성 데이터 총 ${createdIds.length}건 즉시 롤백/삭제 중...`);
      await supabase.from('reservations').delete().in('id', createdIds);
      console.log('✅ 테스트 데이터 100% 삭제 완료 (DB 클린 상태 유지)');
    }
  }
}

runPostMigrationVerification();
