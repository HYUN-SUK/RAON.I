
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkResults() {
  console.log('--- 1. Master Places 가동 현황 ---');
  const { count: masterCount, error: masterErr } = await supabase
    .from('master_places')
    .select('*', { count: 'exact', head: true });
  
  if (masterErr) console.error('Master Places Error:', masterErr);
  else console.log(`Total Master Places: ${masterCount}`);

  const { data: latestMaster, error: masterTimeErr } = await supabase
    .from('master_places')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (masterTimeErr) console.error('Master Time Error:', masterTimeErr);
  else console.log(`Latest Master Entry: ${latestMaster?.[0]?.created_at}`);

  console.log('\n--- 2. Smart Plan Facts (D-3 캐싱) 가동 현황 ---');
  const { count: factCount, error: countErr } = await supabase
    .from('smart_plan_facts')
    .select('*', { count: 'exact', head: true });

  console.log(`Total Smart Plan Facts: ${factCount}`);

  const { data: todayFacts, error: todayErr } = await supabase
    .from('smart_plan_facts')
    .select('id, name, created_at')
    .gte('created_at', '2026-03-16T21:00:00Z')
    .limit(5);

  if (todayErr) console.error('Today Facts Error:', todayErr);
  else {
    console.log(`Facts created today (since 06:00 KST): ${todayFacts?.length || 0}`);
    if (todayFacts && todayFacts.length > 0) {
      console.log('Sample data:', todayFacts[0]);
    }
  }

  console.log('\n--- 3. Target Reservation Check ---');
  const targetDate = '2026-03-20'; // 3/17 기준 D-3
  const { data: resv, error: resvErr } = await supabase
    .from('user_schedules')
    .select('id, user_id, start_date')
    .eq('start_date', targetDate);
  
  if (resvErr) console.error('Reservation check error:', resvErr);
  else console.log(`Reservations for ${targetDate}: ${resv?.length || 0}`);
}

checkResults();
