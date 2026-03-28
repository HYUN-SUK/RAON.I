
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function dump() {
  const { data } = await supabase.from('automation_logs').select('*').order('created_at', { ascending: false }).limit(10);
  fs.writeFileSync('tmp/logs_raw.json', JSON.stringify(data, null, 2));
}
dump();
