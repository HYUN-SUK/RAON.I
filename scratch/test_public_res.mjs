import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function testGetPublicReservations() {
  console.log('=== [get_public_reservations 실측 조회] ===\n');

  const { data, error } = await supabase.rpc('get_public_reservations', {
    p_start_date: '2026-10-01',
    p_end_date: '2026-11-05'
  });

  if (error) {
    console.error('❌ 에러:', error);
  } else {
    console.log(`총 ${data?.length || 0}건의 마감 슬롯(차단일 포함) 반환됨:`);
    console.log(JSON.stringify(data, null, 2));
  }
}

testGetPublicReservations();
