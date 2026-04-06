
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const supabaseKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function extract() {
  const { data } = await supabase
    .from('automation_logs')
    .select('*')
    .eq('job_name', 'DAILY_REGION_SYNC')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!data || data.length === 0) {
    console.error('No logs found.');
    return;
  }

  const log = data[0];
  console.log('--- 7-Key Performance Indicators (7대 핵심 지표) ---');
  console.log(`Region: ${log.api_status[0]?.region || 'N/A'}`);
  console.log(`Job Status: ${log.status}`);
  console.log(`Message: ${log.message}`);
  console.log('--------------------------------------------------');
  
  log.api_status.forEach((cat) => {
    console.log(`[Category: ${cat.name}]`);
    console.log(`  - Existing: ${cat.existing_count}`);
    console.log(`  - Fetched : ${cat.fetched_count}`);
    console.log(`  - New     : ${cat.new_count}`);
    console.log(`  - Updated : ${cat.updated_count}`);
    console.log(`  - Total   : ${cat.total_count}`);
    console.log('-------------------------');
  });
}

extract();
