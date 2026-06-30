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
    .limit(3);

  if (error) {
    console.error('Error fetching logs:', error);
    return;
  }

  data.forEach((log, idx) => {
    console.log(`\n================= LOG #${idx + 1} =================`);
    console.log(`ID: ${log.id}`);
    console.log(`Created At: ${log.created_at}`);
    console.log(`Job Name: ${log.job_name}`);
    console.log(`Status: ${log.status}`);
    console.log(`Message: ${log.message}`);
    
    if (log.api_status) {
      log.api_status.forEach(cat => {
        console.log(`- ${cat.label} (${cat.name}):`);
        console.log(`  Fetched: Active: ${cat.fetched_count?.active}, Inactive: ${cat.fetched_count?.inactive}`);
        console.log(`  Existing: Active: ${cat.existing_count?.active}, Inactive: ${cat.existing_count?.inactive}`);
        console.log(`  New: Active: ${cat.new_count?.active}, Inactive: ${cat.new_count?.inactive}`);
        console.log(`  Updated: Active: ${cat.updated_count?.active}, Inactive: ${cat.updated_count?.inactive}`);
        console.log(`  Total: Active: ${cat.total_count?.active}, Inactive: ${cat.total_count?.inactive}`);
        console.log(`  Note: ${cat.note}`);
      });
    }
  });
}

main();
