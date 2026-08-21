import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function investigateSongMyungChang() {
  console.log('=== [송명창 님 및 site-7 10/23~25 차단일 정밀 분석] ===\n');

  // 1. 송명창 님 예약 레코드
  const { data: songRes } = await supabase
    .from('reservations')
    .select('*')
    .or('guest_name.ilike.%송명창%,guest_phone.ilike.%4229-6622%');

  console.log('1. 송명창 님 예약 레코드:');
  console.log(songRes);

  // 2. site-7의 10월 23일~25일 blocked_dates 레코드
  const { data: site7Block } = await supabase
    .from('blocked_dates')
    .select('*')
    .eq('site_id', 'site-7');

  console.log('\n2. site-7의 모든 blocked_dates 레코드:');
  console.log(site7Block);

  // 3. get_public_reservations RPC를 10월 23일 구간으로 실행했을 때 결과
  const { data: pubRes, error: pubErr } = await supabase.rpc('get_public_reservations', {
    p_start_date: '2026-10-20',
    p_end_date: '2026-10-30'
  });

  console.log('\n3. get_public_reservations(10/20~10/30) 실측 결과 중 site-7:');
  console.log(pubRes?.filter(r => r.site_id === 'site-7'));
}

investigateSongMyungChang();
