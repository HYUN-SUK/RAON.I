
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fullScan() {
  console.log('--- SYSTEM WIDE SCAN ---');
  // We can't query information_schema easily via Supabase Client standard methods
  // So we try all likely names
  const allLikely = [
    'master_places', 
    'master_places_gas', 
    'smart_plan_facts', 
    'user_schedules', 
    'automation_logs', 
    'user_schedule_plans',
    'recommendations',
    'tour_spots',
    'restaurants',
    'marts'
  ];

  for (const t of allLikely) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) {
       // console.log(`Table '${t}' not found.`);
    } else {
       console.log(`Table '${t}': ${count || 0} rows`);
       if (count > 0 && t === 'smart_plan_facts') {
          // If facts exist, we need to know why 3/31 check returned null
          const { data } = await supabase.from(t).select('*').limit(5);
          console.log(`  Facts Sample:`, JSON.stringify(data, null, 2));
       }
    }
  }
}
fullScan();
