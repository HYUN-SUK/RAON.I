
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const supabaseKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  const { data, error } = await supabase.from('master_places').select('category, is_active').eq('sido', '충청북도');
  if (error) {
    console.error('Error:', error);
    return;
  }
  const dist = {};
  data.forEach(i => {
    const k = `${i.category}|${i.is_active}`;
    dist[k] = (dist[k] || 0) + 1;
  });
  console.log('--- Chungbuk Category Distribution ---');
  console.log(JSON.stringify(dist, null, 2));
}

verify();
