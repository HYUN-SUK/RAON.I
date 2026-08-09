import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("🔍 Fetching DAILY_REGION_SYNC logs related to 경기도...");
  
  const { data: logs, error } = await supabase
    .from('automation_logs')
    .select('*')
    .eq('job_name', 'DAILY_REGION_SYNC')
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) {
    console.error("💥 Error fetching logs:", error);
    return;
  }

  const ggLogs = logs.filter(l => 
    l.message?.includes('경기도') || 
    JSON.stringify(l.meta || {}).includes('경기도') ||
    JSON.stringify(l.meta || {}).includes('경기')
  );

  console.log(`\n📊 Found ${ggLogs.length} historical logs for 경기도:\n`);
  ggLogs.forEach((l, idx) => {
    console.log(`[${idx + 1}] KST: ${new Date(l.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    console.log(`    Status: ${l.status}`);
    console.log(`    Message: ${l.message}`);
    console.log(`    Processed: ${l.processed_count}`);
    console.log(`    Meta: ${JSON.stringify(l.meta)}`);
    console.log("-".repeat(80));
  });
}

run();
