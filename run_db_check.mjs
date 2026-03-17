
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runCheck() {
  const result = {
    master_places: {},
    smart_plan_facts: {},
    user_schedules: {},
    target_date: '2026-03-20',
    now_kst: new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString()
  };

  try {
    // 1. Master Places
    const { count: mpCount } = await supabase.from('master_places').select('*', { count: 'exact', head: true });
    const { data: latestMP } = await supabase.from('master_places').select('id, created_at').order('created_at', { ascending: false }).limit(1);
    result.master_places = { count: mpCount, latest_created_at: latestMP?.[0]?.created_at };

    // 2. Smart Plan Facts
    const { count: spfCount } = await supabase.from('smart_plan_facts').select('*', { count: 'exact', head: true });
    // KST 3/17 00:00 is UTC 3/16 15:00. 06:00 is UTC 3/16 21:00.
    const { count: spfToday } = await supabase.from('smart_plan_facts').select('*', { count: 'exact', head: true }).gte('created_at', '2026-03-16T15:00:00Z');
    const { data: sampleSPF } = await supabase.from('smart_plan_facts').select('*').order('created_at', { ascending: false }).limit(1);
    result.smart_plan_facts = { total: spfCount, today: spfToday, sample: sampleSPF?.[0] };

    // 3. User Schedules
    const { data: targetResv } = await supabase.from('user_schedules').select('*').eq('start_date', result.target_date);
    result.user_schedules = { target_date_count: targetResv?.length, samples: targetResv?.slice(0, 2) };

  } catch (err) {
    result.error = err.message;
  }

  fs.writeFileSync('db_check_result.json', JSON.stringify(result, null, 2));
  console.log('Result saved to db_check_result.json');
}

runCheck();
