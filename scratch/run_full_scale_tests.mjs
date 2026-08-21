import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

const VALID_USER_ID = '23603c80-68f5-4717-a609-8d13f8d5a2f6';

async function runFullScaleStressTest() {
  console.log('====================================================');
  console.log('🧪 [풀 스케일 스트레스 테스트 B & C]');
  console.log('====================================================\n');

  const createdIds = [];

  try {
    // ------------------------------------------------------------------
    // 시뮬레이션 B: 8개 전 사이트 × 10월 4개 주말에 40명 가상 유저 동시 발사
    // ------------------------------------------------------------------
    console.log('【시뮬레이션 B】 8개 전 사이트 × 10월 주말 40명 동시 분산 타격');
    
    const sites = ['site-1', 'site-2', 'site-3', 'site-4', 'site-5', 'site-6', 'site-7', 'site-8'];
    const weekends = [
      { checkIn: '2026-10-02', checkOut: '2026-10-04' },
      { checkIn: '2026-10-16', checkOut: '2026-10-18' },
      { checkIn: '2026-10-23', checkOut: '2026-10-25' },
      { checkIn: '2026-10-30', checkOut: '2026-11-01' }
    ];

    // 40개 요청 생성 (각 슬롯당 복수 유저가 경쟁)
    const requestsB = [];
    let userIndex = 1;
    for (const weekend of weekends) {
      for (const siteId of sites) {
        // 같은 슬롯에 2명씩 동시 경쟁 (총 64개 요청)
        for (let attempt = 1; attempt <= 2; attempt++) {
          const uIdx = userIndex++;
          requestsB.push(
            supabase.rpc('create_reservation_safe', {
              p_user_id: VALID_USER_ID,
              p_site_id: siteId,
              p_check_in: weekend.checkIn,
              p_check_out: weekend.checkOut,
              p_total_price: 130000,
              p_guest_name: `경쟁유저_${uIdx}`,
              p_guest_phone: `010-7777-${uIdx.toString().padStart(4, '0')}`
            })
          );
        }
      }
    }

    console.log(`⚡ 총 ${requestsB.length}개 동시 예약 요청 일제히 발사...`);
    const resultsB = await Promise.all(requestsB);

    let successCountB = 0;
    let blockedCountB = 0;

    resultsB.forEach(res => {
      const data = res.data || {};
      if (data.reservation_id) createdIds.push(data.reservation_id);
      if (data.success) successCountB++;
      else blockedCountB++;
    });

    console.log(`  👉 시뮬레이션 B 결과: 총 ${requestsB.length}건 중 성공 ${successCountB}건, 차단 ${blockedCountB}건`);
    console.log(`  👉 32개 슬롯에 각 1명씩 정확히 배정되었는가? -> ${successCountB === 32 ? '🎉 100% 무결 성공!' : '⚠️ 확인 필요'}\n`);

    // ------------------------------------------------------------------
    // 시뮬레이션 C: 에어컨 기기 8대에 15명 동시 신청 (10/16~10/18)
    // ------------------------------------------------------------------
    console.log('【시뮬레이션 C】 에어컨 8대 기기에 15명 동시 신청 타격');
    const airRequests = Array.from({ length: 15 }, (_, i) => {
      // 15명이 8대 기기(air-1 ~ air-8)를 랜덤/순차 배정 시도
      const airSiteId = `air-${(i % 8) + 1}`;
      return supabase.rpc('create_reservation_safe', {
        p_user_id: VALID_USER_ID,
        p_site_id: airSiteId,
        p_check_in: '2026-10-16',
        p_check_out: '2026-10-18',
        p_total_price: 20000,
        p_guest_name: `에어컨신청_${i + 1}`,
        p_guest_phone: `010-8888-${(i + 1).toString().padStart(4, '0')}`
      });
    });

    const resultsC = await Promise.all(airRequests);
    let successCountC = 0;
    let blockedCountC = 0;

    resultsC.forEach(res => {
      const data = res.data || {};
      if (data.reservation_id) createdIds.push(data.reservation_id);
      if (data.success) successCountC++;
      else blockedCountC++;
    });

    console.log(`  👉 시뮬레이션 C 결과: 총 15건 중 성공 ${successCountC}건, 차단 ${blockedCountC}건`);
    console.log(`  👉 8개 기기 100% 분배 완료되었는가? -> ${successCountC === 8 ? '🎉 100% 무결 성공!' : '⚠️ 확인 필요'}\n`);

  } finally {
    if (createdIds.length > 0) {
      console.log(`🧹 테스트 생성 데이터 총 ${createdIds.length}건 즉시 롤백/삭제 중...`);
      await supabase.from('reservations').delete().in('id', createdIds);
      console.log('✅ 테스트 데이터 100% 삭제 완료 (DB 클린 상태)');
    }
  }
}

runFullScaleStressTest();
