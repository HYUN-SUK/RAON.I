import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function inspectStep2() {
  console.log('=== [Step 2: DB RPC 및 제약조건 심층 검사] ===\n');

  // 1. reservations 테이블 제약조건 및 인덱스 조회 (RPC 실행 또는 information_schema)
  const { data: indexes, error: idxErr } = await supabase.rpc('get_table_info_debug', {});
  
  // get_table_info_debug가 없으면 직접 information_schema 쿼리 대신 supabase.from 확인
  console.log('1. DB 인덱스 및 제약조건 확인 시도...');

  // 2. create_reservation_safe 함수 직접 테스트 (동일 사이트, 날짜 겹침 2박 동시성 시뮬레이션)
  console.log('2. [실험] 체크인 날짜가 다른 2박 겹침 시나리오 테스트:');
  console.log('   - 유저 A: site-1, 2026-10-16 ~ 2026-10-18 (체크인 10/16)');
  console.log('   - 유저 B: site-1, 2026-10-17 ~ 2026-10-19 (체크인 10/17)');
  console.log('   👉 10/17이 겹치는 상황에서 두 요청이 0.001초 차이로 동시 진입 시 어떻게 되는가?\n');

  const VALID_USER_ID = '23603c80-68f5-4717-a609-8d13f8d5a2f6';

  // 동시 발사 (Promise.all)
  const [resA, resB] = await Promise.all([
    supabase.rpc('create_reservation_safe', {
      p_user_id: VALID_USER_ID,
      p_site_id: 'site-1',
      p_check_in: '2026-10-16',
      p_check_out: '2026-10-18',
      p_family_count: 1,
      p_visitor_count: 0,
      p_vehicle_count: 1,
      p_total_price: 140000,
      p_guest_name: '[테스트_유저A]',
      p_guest_phone: '010-1111-2222',
      p_requests: '동시성 진단 A'
    }),
    supabase.rpc('create_reservation_safe', {
      p_user_id: VALID_USER_ID,
      p_site_id: 'site-1',
      p_check_in: '2026-10-17',
      p_check_out: '2026-10-19',
      p_family_count: 1,
      p_visitor_count: 0,
      p_vehicle_count: 1,
      p_total_price: 140000,
      p_guest_name: '[테스트_유저B]',
      p_guest_phone: '010-3333-4444',
      p_requests: '동시성 진단 B'
    })
  ]);

  console.log('결과 A:', resA.data || resA.error);
  console.log('결과 B:', resB.data || resB.error);

  // 생성된 테스트 데이터 즉시 정리
  const createdIds = [];
  if (resA.data?.reservation_id) createdIds.push(resA.data.reservation_id);
  if (resB.data?.reservation_id) createdIds.push(resB.data.reservation_id);

  if (createdIds.length > 0) {
    console.log(`\n🧹 테스트 생성 데이터 ${createdIds.length}건 즉시 롤백/삭제 중...`);
    await supabase.from('reservations').delete().in('id', createdIds);
    console.log('✅ 테스트 데이터 삭제 완료.');
  }
}

inspectStep2();
