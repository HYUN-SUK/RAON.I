import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function investigateLeeYoungSe() {
  console.log('=== [이영세 님 예약건 정밀 조사] ===\n');

  // 1. reservations 테이블에서 이영세 님 예약 조회
  const { data: resData, error: resErr } = await supabase
    .from('reservations')
    .select('*')
    .or('guest_name.ilike.%이영세%,guest_phone.ilike.%7427-7700%');

  console.log('1. [이영세 님 예약 데이터]');
  console.log(resData);

  // 2. 10월 9일 관련 모든 예약 조회
  const { data: oct9Res, error: oct9Err } = await supabase
    .from('reservations')
    .select('*')
    .lte('check_in_date', '2026-10-11')
    .gte('check_out_date', '2026-10-09');

  console.log('\n2. [10월 9일~11일 모든 예약 데이터]');
  console.log(oct9Res);

  // 3. 10월 9일 관련 blocked_dates 조회
  const { data: oct9Blocks, error: blockErr } = await supabase
    .from('blocked_dates')
    .select('*')
    .lte('start_date', '2026-10-11')
    .gte('end_date', '2026-10-09');

  console.log('\n3. [10월 9일~11일 blocked_dates 차단 내역]');
  console.log(oct9Blocks);
}

investigateLeeYoungSe();
