import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const { data, error } = await supabase
    .from('automation_logs')
    .select('*')
    .eq('job_name', 'DAILY_REGION_SYNC')
    .order('created_at', { ascending: false })
    .limit(1); // 가장 최근인 LOG #1 (경기도)

  if (error) {
    console.error('Error fetching logs:', error);
    return;
  }

  const log = data[0];
  console.log(`[${log.created_at}] Message: ${log.message}`);
  
  if (log.api_status) {
    log.api_status.forEach(cat => {
      console.log(`\nCategory: ${cat.label} (${cat.name})`);
      console.log(`  Fetched: ${JSON.stringify(cat.fetched_count)}`);
      console.log(`  Existing: ${JSON.stringify(cat.existing_count)}`);
      console.log(`  New: ${JSON.stringify(cat.new_count)}`);
      console.log(`  Updated: ${JSON.stringify(cat.updated_count)}`);
      console.log(`  Total: ${JSON.stringify(cat.total_count)}`);
      console.log(`  Note: ${cat.note}`);
    });
  }
}

main();
