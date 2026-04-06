
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const supabaseKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  const cats = ['RESTAURANT', 'MART', 'SPOT'];
  const results = {};

  for (const cat of cats) {
    const { count: active } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('sido', '충청북도').eq('category', cat).eq('is_active', true);
    const { count: inactive } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('sido', '충청북도').eq('category', cat).eq('is_active', false);
    results[cat] = { active, inactive };
  }

  console.log('--- TRUE COUNTS for Chungbuk (No Limit) ---');
  console.log(JSON.stringify(results, null, 2));
}

verify();
