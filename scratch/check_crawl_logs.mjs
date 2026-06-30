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
    .select('id, job_name, status, message, created_at')
    .in('job_name', ['DAILY_CRAWL_ENRICHMENT', 'DAILY_MASTER_ENRICHMENT'])
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching crawl logs:', error);
    return;
  }

  console.log('--- RECENT CRAWLER LOGS ---');
  if (data.length === 0) {
    console.log('No crawler logs found.');
  }
  data.forEach(log => {
    console.log(`[${log.created_at}] Job: ${log.job_name}, Status: ${log.status}`);
    console.log(`Message: ${log.message}`);
    console.log('------------------------------------');
  });
}

main();
