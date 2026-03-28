
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectFunctions() {
  console.log('--- DB FUNCTION INSPECTION ---');
  // We can't use eval if it is restricted. Let's try to query a known table with some SQL-like filters.
  // Actually, I'll use PROG_PROC if possible via a direct postgres query if Antigravity has the tool?
  // Wait! I have "run_command" with psql? No, I have node.
  
  // I'll try calling get_master_places_in_radius with NO category to see if it responds.
  const tests = [
    { target_lat: 36.626909, target_lng: 126.764786, radius_meters: 30000, limit_count: 5 },
    { p_lat: 36.626909, p_lng: 126.764786, p_radius: 30000, p_limit: 5 }
  ];

  for (const t of tests) {
    const { data, error } = await supabase.rpc('get_master_places_in_radius', t);
    console.log('Test:', JSON.stringify(t), '->', error ? error.message : `Success: ${data?.length}`);
  }
}
inspectFunctions();
