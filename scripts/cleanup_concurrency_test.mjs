import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Service key missing');
  process.exit(1);
}

const adminSupabase = createClient(supabaseUrl, serviceKey);

async function cleanUpTestReservations() {
  console.log('🧹 [원상복구] 테스트 가상 예약 데이터 삭제 시작...');

  const { data, error, count } = await adminSupabase
    .from('reservations')
    .delete({ count: 'exact' })
    .ilike('requests', '%동시성 시뮬레이션 테스트%');

  if (error) {
    console.error('❌ 원상복구 중 에러 발생:', error);
    return;
  }

  console.log(`✅ 원상복구 완료! (삭제된 테스트 예약 건수: ${count}건)`);
}

cleanUpTestReservations();
