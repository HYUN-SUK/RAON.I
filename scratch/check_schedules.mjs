import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function checkSchedules() {
  const { data: schedules, error } = await supabase
    .from('user_schedules')
    .select('id, user_id, record_written, status')
    .limit(10);

  if (error) {
    console.error('Error fetching schedules:', error.message);
    return;
  }

  console.log('\n📊 user_schedules 상태:');
  schedules.forEach(s => console.log(`  - [${s.record_written ? '작성완료✓' : '미작성'}] ID: ${s.id} (user: ${s.user_id})`));
}

checkSchedules();
