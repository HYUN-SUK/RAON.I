
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function scan() {
  console.log('--- SCANNING ALL TABLES ---');
  // We don't have a direct list of tables, but we can guess or try to find them.
  // Common names in RAON.I:
  const tables = [
    'master_places', 
    'master_places_gas', 
    'smart_plan_facts', 
    'user_schedules', 
    'automation_logs', 
    'user_schedule_plans',
    'recommendations'
  ];

  for (const t of tables) {
    try {
      const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
      console.log(`Table '${t}': ${count || 0} rows`);
      
      if (count > 0) {
        const { data: recent } = await supabase.from(t).select('*').order('created_at', { ascending: false }).limit(20);
        console.log(`  Latest in '${t}': Created at ${recent[0]?.created_at}`);
        // If smart_plan_facts, check for "Yesan" or specific category counts
        if (t === 'smart_plan_facts') {
           const cats = ['RESTAURANT', 'SPOT', 'MART', 'HOSPITAL', 'GAS_STATION', 'FESTIVAL'];
           for (const c of cats) {
              const { count: catCount } = await supabase.from(t).select('*', { count: 'exact', head: true }).eq('category', c);
              console.log(`    ${c}: ${catCount || 0}`);
           }
        }
      }
    } catch (e) {
      console.log(`Table '${t}' error: ${e.message}`);
    }
  }
}
scan();
