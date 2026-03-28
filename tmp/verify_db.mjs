
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
  console.log('--- DB Verification Step ---');
  const { data, error } = await supabase.from('master_places').select('*').limit(1);
  if (error) {
    console.error('Query Error:', error.message);
  } else {
    console.log('Record Found:', JSON.stringify(data?.[0], null, 2));
  }
}
verify();
