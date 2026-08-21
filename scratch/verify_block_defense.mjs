import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

const VALID_USER_ID = '23603c80-68f5-4717-a609-8d13f8d5a2f6';

async function testBlockedDateDefense() {
  console.log('====================================================');
  console.log('🛡️ [재발 방지 실측 검증] 관리자 차단일 예약 시도 시 DB 차단 여부');
  console.log('====================================================\n');

  // 테스트 1: 넥슨 대관일(10/9~10/11) site-1에 강제 예약 시도
  console.log('【테스트 1】 넥슨 대관일 (10/9~10/11) site-1에 강제 웹 예약 시도');
  const res1 = await supabase.rpc('create_reservation_safe', {
    p_user_id: VALID_USER_ID,
    p_site_id: 'site-1',
    p_check_in: '2026-10-09',
    p_check_out: '2026-10-11',
    p_total_price: 140000,
    p_guest_name: '강제침투_테스트',
    p_guest_phone: '010-9999-9999'
  });

  console.log('  👉 RPC 응답 결과:', res1.data);
  if (!res1.data.success && res1.data.error === 'ALREADY_BOOKED') {
    console.log('  🎉 테스트 1 통과! (DB가 차단일을 감지하여 100% 안전 차단 성공!)\n');
  } else {
    console.error('  ❌ 테스트 1 실패! (여전히 뚫림! SQL 실행 여부 확인 필요)\n');
  }

  // 테스트 2: 선애 님 차단일(10/23~10/25) site-7에 강제 예약 시도
  console.log('【테스트 2】 선애 님 차단일 (10/23~10/25) site-7에 강제 웹 예약 시도');
  const res2 = await supabase.rpc('create_reservation_safe', {
    p_user_id: VALID_USER_ID,
    p_site_id: 'site-7',
    p_check_in: '2026-10-23',
    p_check_out: '2026-10-25',
    p_total_price: 140000,
    p_guest_name: '강제침투_테스트2',
    p_guest_phone: '010-9999-9998'
  });

  console.log('  👉 RPC 응답 결과:', res2.data);
  if (!res2.data.success && res2.data.error === 'ALREADY_BOOKED') {
    console.log('  🎉 테스트 2 통과! (DB가 차단일을 감지하여 100% 안전 차단 성공!)\n');
  } else {
    console.error('  ❌ 테스트 2 실패!\n');
  }
}

testBlockedDateDefense();
