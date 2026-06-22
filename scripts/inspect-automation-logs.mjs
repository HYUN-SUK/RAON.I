import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase configuration");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspect() {
  console.log("Fetching recent automation logs related to PUBLIC_BULK_ENRICHMENT...");
  
  const { data: logs, error } = await supabase
    .from('automation_logs')
    .select('id, job_name, status, processed_count, message, duration_ms, api_status, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error fetching logs:", error.message);
    process.exit(1);
  }

  console.log(`\nFound ${logs.length} recent logs:\n`);
  logs.forEach((log, index) => {
    console.log(`[Log #${index + 1}] ID: ${log.id}`);
    console.log(`Job Name: ${log.job_name}`);
    console.log(`Status: ${log.status}`);
    console.log(`Processed Count: ${log.processed_count}`);
    console.log(`Message: ${log.message}`);
    console.log(`Created At: ${log.created_at}`);
    if (log.api_status) {
      console.log(`API Status Details:`, JSON.stringify(log.api_status, null, 2));
    }
    console.log('-'.repeat(60));
  });
}

inspect();
