const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLastLog() {
  const { data, error } = await supabase
    .from('automation_logs')
    .select('created_at, api_status')
    .eq('job_name', 'API_HEALTH_CHECK')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('| API Name | Status | Duration |');
  console.log('| :--- | :--- | :--- |');
  if (data.api_status && Array.isArray(data.api_status)) {
    data.api_status.forEach(api => {
      console.log(`| ${api.label} | ${api.status === 'SUCCESS' ? '✅ SUCCESS' : '❌ FAILURE'} | ${api.duration_ms}ms |`);
    });
  }
}

checkLastLog();
