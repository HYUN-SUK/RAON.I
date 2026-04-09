import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const r1 = await s.from('automation_logs').select('id, job_name, status, created_at')
    .eq('job_name', 'SMART_PLAN_CACHING').order('created_at', { ascending: false }).limit(5);
  const r2 = await s.from('smart_plan_facts').select('*', { count: 'exact', head: true });
  const r3 = await s.from('smart_plan_facts').select('*', { count: 'exact', head: true }).eq('target_date', '2026-04-12');
  const r4 = await s.from('user_schedules').select('id, start_date')
    .gte('start_date', '2026-04-10').lte('start_date', '2026-04-15').limit(10);
  const r5 = await s.from('smart_plan_facts').select('created_at').order('created_at', { ascending: false }).limit(1);

  const result = {
    caching_logs: r1.data,
    total_facts: r2.count,
    target_0412_facts: r3.count,
    upcoming_reservations: r4.data,
    latest_fact_created: r5.data?.[0]?.created_at
  };
  
  fs.writeFileSync('tmp/d3_out.txt', JSON.stringify(result, null, 2), 'utf8');
}
check();
