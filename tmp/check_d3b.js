import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // 1. user_schedules schema check
  const r1 = await s.from('user_schedules').select('*').limit(1);
  
  // 2. check_in field test  
  const r2 = await s.from('user_schedules').select('id, check_in, start_date').limit(3);
  
  // 3. All schedules count
  const r3 = await s.from('user_schedules').select('*', { count: 'exact', head: true });
  
  // 4. GitHub Actions workflow runs check
  const r4 = await s.from('automation_logs').select('job_name, status, created_at')
    .order('created_at', { ascending: false }).limit(10);

  const result = {
    sample_schedule_columns: r1.data?.[0] ? Object.keys(r1.data[0]) : [],
    sample_schedules: r2.data,
    total_schedules: r3.count,
    recent_all_logs: r4.data
  };
  
  fs.writeFileSync('tmp/d3_detail.txt', JSON.stringify(result, null, 2), 'utf8');
}
check();
