import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testHeadQuery() {
  console.log('=== [head: true vs 일반 select 카운트 쿼리 비교] ===\n');

  // 1. Anon 클라이언트 (브라우저와 동일)
  const anonSupabase = createClient(supabaseUrl, anonKey);

  console.log('1. [Anon Client] head: true 쿼리:');
  const { count: c1, error: e1 } = await anonSupabase
    .from('reservations')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'PENDING');
  console.log('결과 c1:', c1, '에러:', e1);

  console.log('\n2. [Anon Client] 일반 select data 쿼리:');
  const { data: d2, error: e2 } = await anonSupabase
    .from('reservations')
    .select('id, status')
    .eq('status', 'PENDING');
  console.log('결과 건수:', d2?.length, '에러:', e2);

  // 3. Service Role 클라이언트
  const adminSupabase = createClient(supabaseUrl, serviceKey);
  console.log('\n3. [Admin Service Role Client] 카운트:');
  const { count: c3, error: e3 } = await adminSupabase
    .from('reservations')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'PENDING');
  console.log('결과 c3:', c3, '에러:', e3);
}

testHeadQuery();
