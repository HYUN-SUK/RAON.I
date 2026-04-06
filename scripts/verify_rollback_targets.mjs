
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const supabaseKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log('--- Debugging Rollback Condition ---');
  
  // 1. Total records with sido = 충청북도
  const { count: totalChungbuk } = await supabase
    .from('master_places')
    .select('*', { count: 'exact', head: true })
    .eq('sido', '충청북도');
  console.log(`Total in Chungbuk: ${totalChungbuk}`);

  // 2. Active vs Inactive in Chungbuk
  const { count: active } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('sido', '충청북도').eq('is_active', true);
  const { count: inactive } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('sido', '충청북도').eq('is_active', false);
  console.log(`Active: ${active} | Inactive: ${inactive}`);

  // 3. Find when the inactive ones were updated
  const { data: latestInactivities } = await supabase
    .from('master_places')
    .select('id, updated_at')
    .eq('sido', '충청북도')
    .eq('is_active', false)
    .order('updated_at', { ascending: false })
    .limit(10);
  
  console.log('Latest Inactivities (Top 10):');
  console.log(JSON.stringify(latestInactivities, null, 2));
}

verify();
