
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const supabaseKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBreakdown() {
  const { data, error } = await supabase
    .from('master_places')
    .select('api_source, category, is_active')
    .eq('sido', '충청북도');

  if (error) {
    console.error('Error:', error);
    return;
  }

  const stats = {};
  data.forEach(item => {
    const k = `${item.category}|${item.api_source}`;
    if (!stats[k]) stats[k] = { category: item.category, api_source: item.api_source, active: 0, inactive: 0 };
    if (item.is_active) stats[k].active++;
    else stats[k].inactive++;
  });

  console.log('--- Breakdown by Category and API Source (Chungbuk) ---');
  Object.values(stats).forEach(s => {
    console.log(`- ${s.category} [${s.api_source}]: Active=${s.active}, Inactive=${s.inactive}`);
  });
}

checkBreakdown();
