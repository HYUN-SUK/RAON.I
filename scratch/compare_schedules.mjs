import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function compareSchedules() {
  console.log('=== [독산해수욕장캠핑장 vs 라온아이(영희네) 일정 데이터 1:1 비교] ===\n');

  // 1. 독산해수욕장캠핑장 일정 조회
  const { data: externalScheds } = await supabase
    .from('user_schedules')
    .select('*')
    .ilike('campground_name', '%독산%')
    .order('created_at', { ascending: false })
    .limit(1);

  // 2. 영희네(라온아이 9/1) 일정 조회
  const { data: raonScheds } = await supabase
    .from('user_schedules')
    .select('*')
    .eq('source', 'raonai')
    .ilike('campground_name', '%영희%')
    .order('created_at', { ascending: false })
    .limit(1);

  console.log('--- [1. 독산해수욕장캠핑장 (정상 동작)] ---');
  console.log(JSON.stringify(externalScheds?.[0], null, 2));

  console.log('\n--- [2. 영희네 라온아이 (화면 미노출)] ---');
  console.log(JSON.stringify(raonScheds?.[0], null, 2));
}

compareSchedules();
