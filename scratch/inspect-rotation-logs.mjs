import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { data: logs, error } = await supabase
    .from('automation_logs')
    .select('id, job_name, status, processed_count, message, duration_ms, api_status, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error(error);
    return;
  }

  logs.forEach((log) => {
    console.log(`[${log.created_at}] Job: ${log.job_name} | Status: ${log.status} | Msg: ${log.message}`);
    if (log.api_status && Array.isArray(log.api_status)) {
      log.api_status.forEach((cat) => {
        console.log(`  -> Category: ${cat.label} (Region: ${cat.region}) | Fetched: ${cat.fetched_count?.active || 0}/${cat.fetched_count?.inactive || 0} | Note: ${cat.note || 'OK'}`);
      });
    } else if (log.api_status) {
      console.log(`  -> API Status:`, JSON.stringify(log.api_status).substring(0, 300));
    }
  });
}
run();
