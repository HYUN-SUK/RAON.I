import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("🔍 [Today Run Check] Fetching automation_logs for August 6th...");
  
  // Query logs from 2026-08-06 KST (UTC 2026-08-05T15:00:00Z)
  const { data: logs, error } = await supabase
    .from('automation_logs')
    .select('*')
    .gt('created_at', '2026-08-05T15:00:00Z')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("💥 Error fetching logs:", error.message);
    return;
  }

  console.log(`📊 Found ${logs.length} logs for August 6th:\n`);
  logs.forEach((l, idx) => {
    console.log(`[${idx + 1}] KST: ${new Date(l.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    console.log(`    Job: ${l.job_name} | Status: ${l.status}`);
    console.log(`    Message: ${l.message}`);
    console.log("-".repeat(60));
  });
}

run();
