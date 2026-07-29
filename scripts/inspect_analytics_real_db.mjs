import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Service key missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function inspectRealDb() {
  console.log('====================================================');
  console.log('🔍 DB 원본 실데이터 긴급 정밀 점검');
  console.log('====================================================\n');

  // 1. Total Profiles count & recent profiles
  const { data: profiles, count: profileCount } = await supabase
    .from('profiles')
    .select('id, nickname, created_at, updated_at', { count: 'exact' })
    .order('created_at', { ascending: false });

  console.log(`📌 1. Profiles (회원) 총 수: ${profileCount}명`);
  console.log(`   최근 가입 5명:`, profiles?.slice(0, 5));

  // 2. smart_plan_facts
  const { data: facts, count: factsCount } = await supabase
    .from('smart_plan_facts')
    .select('*', { count: 'exact' });

  console.log(`\n📌 2. smart_plan_facts (스마트플랜 팩트) 총 수: ${factsCount}건`);
  console.log(`   스마트플랜 팩트 샘플:`, facts);

  // 3. schedules with smart_plan
  const { data: schedules, count: schedCount } = await supabase
    .from('schedules')
    .select('id, user_id, title, smart_plan, created_at', { count: 'exact' });

  console.log(`\n📌 3. schedules (일정) 총 수: ${schedCount}건`);
  console.log(`   일정 중 smart_plan 존재하는 건:`, schedules?.filter(s => s.smart_plan));

  // 4. reservations
  const { data: reservations, count: resCount } = await supabase
    .from('reservations')
    .select('id, user_id, guest_name, check_in_date, created_at', { count: 'exact' });

  console.log(`\n📌 4. reservations (예약) 총 수: ${resCount}건`);
  console.log(`   최근 예약 샘플:`, reservations?.slice(0, 5));

  // 5. persona_actions
  const { data: actions, count: actionCount } = await supabase
    .from('persona_actions')
    .select('*', { count: 'exact' });

  console.log(`\n📌 5. persona_actions (행동 로그) 총 수: ${actionCount}건`);
  console.log(`   행동 로그 샘플:`, actions?.slice(0, 10));

  // 6. camping_records
  const { data: records, count: recordCount } = await supabase
    .from('camping_records')
    .select('id, user_id, created_at', { count: 'exact' });

  console.log(`\n📌 6. camping_records (10초 기록) 총 수: ${recordCount}건`);

  // 7. posts
  const { data: posts, count: postCount } = await supabase
    .from('posts')
    .select('id, title, author_id, read_count, created_at', { count: 'exact' });

  console.log(`\n📌 7. posts (게시글) 총 수: ${postCount}건`);
  console.log(`   게시글 샘플:`, posts?.slice(0, 5));

  console.log('\n====================================================\n');
}

inspectRealDb();
