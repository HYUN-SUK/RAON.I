import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
  console.log('=== 소스명 잔재 점검 ===');
  const legacy = ['MOIS_GOOD_RESTAURANT', 'LOCALDATA_MART_SUPER'];
  for (const src of legacy) {
    const { count } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('api_source', src);
    console.log(`${src}: ${count}건 잔존`);
  }

  console.log('\n=== 현행 소스명별 데이터 현황 ===');
  const current = ['SAFE_RESTAURANT', 'LOCALDATA_RESTAURANT_GOOD', 'SMBA_BAEK', 'LOCALDATA_MART_LARGE', 'LOCALDATA_MART_SSM', 'LOCALDATA_MART_OTHER', 'TOUR_SPOT'];
  for (const src of current) {
    const { count } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('api_source', src);
    console.log(`${src}: ${count}건`);
  }

  console.log('\n=== 전라남도 is_active 상태 ===');
  const { count: active } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('sido', '전라남도').eq('is_active', true);
  const { count: inactive } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('sido', '전라남도').eq('is_active', false);
  console.log(`Active: ${active}건 | Inactive: ${inactive}건`);

  console.log('\n=== 전체 master_places 총 건수 ===');
  const { count: total } = await supabase.from('master_places').select('*', { count: 'exact', head: true });
  console.log(`Total: ${total}건`);
}
verify();
