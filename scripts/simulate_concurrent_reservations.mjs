import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  console.error('Supabase URL or Anon Key missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, anonKey);

async function runConcurrencyTest() {
  console.log('====================================================');
  console.log('🚀 [라온아이] 10인 동시 예약 스트레스 시뮬레이션 실험');
  console.log('====================================================\n');

  const siteId = 'site-1'; // 철수네
  const checkIn = '2026-11-20';
  const checkOut = '2026-11-22';
  
  // Real Valid User ID from DB
  const VALID_USER_ID = '23603c80-68f5-4717-a609-8d13f8d5a2f6';

  const testUsers = Array.from({ length: 10 }, (_, i) => ({
    id: VALID_USER_ID,
    name: `가상유저_${(i + 1).toString().padStart(2, '0')}`,
    phone: `010-9999-00${(i + 1).toString().padStart(2, '0')}`
  }));

  console.log(`📍 Target Site: ${siteId} (철수네)`);
  console.log(`📅 Target Date: ${checkIn} ~ ${checkOut} (2박)`);
  console.log(`👥 Concurrent Users: 10명 (동시 타격 시도)\n`);
  console.log('⚡ 0.001초 동시 예약 요청 발사중...\n');

  const startTime = Date.now();

  // 10명의 동시 요청 발사 (Promise.all)
  const results = await Promise.all(
    testUsers.map(async (user, index) => {
      const requestStart = Date.now();
      try {
        const { data, error } = await supabase.rpc('create_reservation_safe', {
          p_user_id: user.id,
          p_site_id: siteId,
          p_check_in: checkIn,
          p_check_out: checkOut,
          p_family_count: 1,
          p_visitor_count: 0,
          p_vehicle_count: 1,
          p_total_price: 100000,
          p_guest_name: user.name,
          p_guest_phone: user.phone,
          p_requests: `[동시성 시뮬레이션 테스트] 유저 ${index + 1}`
        });

        const elapsed = Date.now() - requestStart;

        if (error) {
          return { user: user.name, success: false, error: 'RPC_ERROR', message: error.message, elapsed };
        }

        const res = data || {};
        return {
          user: user.name,
          success: !!res.success,
          reservationId: res.reservation_id,
          error: res.error || null,
          message: res.message,
          elapsed
        };
      } catch (err) {
        return { user: user.name, success: false, error: 'EXCEPTION', message: err.message, elapsed: Date.now() - requestStart };
      }
    })
  );

  const totalElapsed = Date.now() - startTime;

  console.log('----------------------------------------------------');
  console.log('📋 [실험 결과 개별 타격 리포트]');
  console.log('----------------------------------------------------');

  let successCount = 0;
  let blockedCount = 0;
  let successReservationId = null;
  let successUserName = null;

  results.forEach((res, idx) => {
    const statusSymbol = res.success ? '✅ SUCCESS' : '❌ BLOCKED';
    if (res.success) {
      successCount++;
      successReservationId = res.reservationId;
      successUserName = res.user;
    } else {
      blockedCount++;
    }

    console.log(
      `[유저 ${(idx + 1).toString().padStart(2, '0')}] ${res.user} | Status: ${statusSymbol} | ErrorCode: ${res.error || 'NONE'} | Elapsed: ${res.elapsed}ms`
    );
    console.log(`   └─ Message: ${res.message}`);
  });

  console.log('\n====================================================');
  console.log('📊 [최종 검증 요약 보고서]');
  console.log('====================================================');
  console.log(`⏱ 총 처리 시간: ${totalElapsed}ms`);
  console.log(`🎯 총 시도 인원: 10명`);
  console.log(`✅ 예약 성공 인원: ${successCount}명 (${successUserName || '없음'})`);
  console.log(`🛡 차단 처리 인원: ${blockedCount}명`);

  if (successCount === 1 && blockedCount === 9) {
    console.log('\n🎉 [결론] 동시성 제어 무결성 100% 검증 성공!');
    console.log('   👉 10명이 0.001초 차이로 동시 진입했으나, 가장 빠른 1명만 통과되고 나머지 9명은 안전하게 차단되었습니다.');
    console.log(`   📌 생성된 성공 예약 ID: ${successReservationId}`);
  } else {
    console.log('\n⚠️ [주의] 결과 확인 필요');
  }
  console.log('====================================================\n');
}

runConcurrencyTest();
