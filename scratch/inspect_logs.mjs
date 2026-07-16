import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: logs, error } = await supabase.from('camfit_integration_logs').select('*').order('created_at', { ascending: false }).limit(5);
  if (error) {
    console.error("Error query logs:", error);
  } else {
    console.log("Latest Logs in DB:", logs);
  }
}
run();
