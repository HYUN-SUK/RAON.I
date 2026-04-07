
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const supabaseKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNonNullSido() {
  const { count } = await supabase
    .from('master_places')
    .select('*', { count: 'exact', head: true })
    .not('sido', 'is', null);

  console.log(`Master places with non-null sido: ${count || 0}`);
  
  if (count > 0) {
    const { data } = await supabase
      .from('master_places')
      .select('sido')
      .not('sido', 'is', null)
      .limit(10);
    console.log('Sample non-null sidos:', [...new Set(data.map(d => d.sido))]);
  }
}

checkNonNullSido();
