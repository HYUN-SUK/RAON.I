import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase URL or Key");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('automation_logs')
    .select('*')
    .eq('job_name', 'DAILY_REGION_SYNC')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error fetching logs:", error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log("No DAILY_REGION_SYNC logs found.");
    process.exit(0);
  }

  const log = data[0];
  console.log(`=== Latest DAILY_REGION_SYNC Log ===`);
  console.log(`ID: ${log.id}`);
  console.log(`Created At: ${log.created_at}`);
  console.log(`Status: ${log.status}`);
  console.log(`Message: ${log.message}`);
  console.log(`Processed Count: ${log.processed_count}`);
  console.log(`\n=== API Status Breakdown ===`);
  console.dir(log.api_status, { depth: null });
}

main();
