import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function inspectOctoberReservations() {
  console.log('====================================================');
  console.log('🔍 [10월 전체 예약 실시간 정합성 & 중복 여부 전수 검사]');
  console.log('====================================================\n');

  // 1. 10월~11월 예약 전체 조회
  const { data: octRes, error: resErr } = await supabase
    .from('reservations')
    .select('*')
    .gte('check_out_date', '2026-10-01')
    .lte('check_in_date', '2026-11-05')
    .order('site_id', { ascending: true })
    .order('check_in_date', { ascending: true });

  if (resErr) {
    console.error('❌ 예약 조회 실패:', resErr);
    return;
  }

  // 2. 10월 blocked_dates 전체 조회
  const { data: octBlocks, error: blockErr } = await supabase
    .from('blocked_dates')
    .select('*')
    .gte('end_date', '2026-10-01')
    .lte('start_date', '2026-11-05');

  console.log(`📊 10월 총 예약 건수: ${octRes?.length || 0}건`);
  console.log(`📊 10월 관리자 차단 건수: ${octBlocks?.length || 0}건\n`);

  console.log('【10월 전체 예약 목록】');
  octRes?.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.site_id}] ${r.check_in_date} ~ ${r.check_out_date} (${r.nights}박) | ${r.guest_name} (${r.guest_phone}) | 상태: ${r.status} | 금액: ${r.total_price?.toLocaleString()}원 | 생성: ${r.created_at}`);
  });

  // 3. 중복(Double Booking) 예약 검사 (reservations 간)
  const activeRes = octRes?.filter(r => r.status !== 'CANCELLED' && r.status !== 'REFUNDED') || [];
  let duplicateCount = 0;

  console.log('\n----------------------------------------------------');
  console.log('🔍 [1. 예약 간 날짜 겹침(Double Booking) 검사]');
  for (let i = 0; i < activeRes.length; i++) {
    for (let j = i + 1; j < activeRes.length; j++) {
      const r1 = activeRes[i];
      const r2 = activeRes[j];

      if (r1.site_id === r2.site_id) {
        const in1 = new Date(r1.check_in_date);
        const out1 = new Date(r1.check_out_date);
        const in2 = new Date(r2.check_in_date);
        const out2 = new Date(r2.check_out_date);

        // 겹침 판정
        if (in1 < out2 && out1 > in2) {
          console.error(`🚨 [중복 발생!] [${r1.site_id}] ${r1.guest_name}(${r1.check_in_date}~${r1.check_out_date}) vs ${r2.guest_name}(${r2.check_in_date}~${r2.check_out_date})`);
          duplicateCount++;
        }
      }
    }
  }

  if (duplicateCount === 0) {
    console.log('🎉 [검증 완료] 예약 간 중복(Double Booking) 건수: 0건 (100% 무결!)');
  } else {
    console.log(`⚠️ 총 ${duplicateCount}건의 중복 예약 발견!`);
  }

  // 4. 차단일(blocked_dates)과의 겹침 검사
  console.log('\n----------------------------------------------------');
  console.log('🔍 [2. 관리자 차단일(blocked_dates)과의 겹침 검사]');
  let blockOverlapCount = 0;

  for (const r of activeRes) {
    for (const b of (octBlocks || [])) {
      if (b.site_id === r.site_id || b.site_id === 'ALL') {
        const rIn = new Date(r.check_in_date);
        const rOut = new Date(r.check_out_date);
        const bIn = new Date(b.start_date);
        const bOut = new Date(b.end_date);

        if (rIn < bOut && rOut > bIn) {
          console.warn(`⚠️ [차단일 중복] [${r.site_id}] 예약: ${r.guest_name}(${r.check_in_date}~${r.check_out_date}) vs 차단: ${b.guest_name || '차단'}(${b.start_date}~${b.end_date})`);
          blockOverlapCount++;
        }
      }
    }
  }

  if (blockOverlapCount === 0) {
    console.log('🎉 차단일과의 겹침: 0건');
  } else {
    console.log(`📌 차단일과 겹치는 예약: 총 ${blockOverlapCount}건 (확인 필요)`);
  }
}

inspectOctoberReservations();
