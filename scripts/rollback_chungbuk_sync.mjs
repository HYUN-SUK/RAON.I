
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const supabaseKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function rollback() {
  console.log('🚀 Starting Rollback for Chungbuk (API Fail Recovery)...');
  
  // Update is_active = true for those deactivated recently (today around 16:41 KST)
  const { count, error } = await supabase
    .from('master_places')
    .update({ is_active: true })
    .eq('sido', '충청북도')
    .eq('is_active', false)
    .gte('updated_at', '2026-04-06T07:40:00Z') // Sync started around 07:40 UTC
    .select('id', { count: 'exact' });

  if (error) {
    console.error('❌ Rollback Error:', error.message);
  } else {
    console.log(`✅ Successfully restored ${count || 0} records for Chungbuk!`);
  }
}

rollback();
