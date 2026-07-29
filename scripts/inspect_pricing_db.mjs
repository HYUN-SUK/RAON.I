import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectData() {
  console.log('--- 1. Inspecting site_config ---');
  const { data: configData, error: configErr } = await supabase.from('site_config').select('*').eq('id', 1);
  console.log('configErr:', configErr);
  console.log('configData:', JSON.stringify(configData, null, 2));

  console.log('\n--- 2. Inspecting sites table ---');
  const { data: sitesData, error: sitesErr } = await supabase.from('sites').select('id, name, weekday, weekend, peak_weekday, peak_weekend, base_price, price').limit(5);
  console.log('sitesErr:', sitesErr);
  console.log('sitesData:', JSON.stringify(sitesData, null, 2));
}

inspectData();
