
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const supabaseKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function deployPublicReservationFix() {
  console.log('🚀 Deploying public reservation fix to Supabase DB...');
  const sql = fs.readFileSync('supabase/migrations/20260124000000_get_public_reservations.sql', 'utf8');
  
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('❌ SQL Migration Failed:', error.message);
  } else {
    console.log('✅ SQL Migration Completed successfully!');
  }
}

deployPublicReservationFix();
