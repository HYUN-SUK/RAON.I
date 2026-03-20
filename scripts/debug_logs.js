const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkLogs() {
    const { data, error } = await supabase
        .from('automation_logs')
        .select('job_name, status, message, created_at, processed_count')
        .gte('created_at', '2026-03-18T21:00:00Z')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('--- TODAY AUTOMATION LOGS ---');
    data.forEach(log => {
        console.log(`[${log.created_at}] ${log.job_name}`);
        console.log(`  - Status: ${log.status}`);
        console.log(`  - Count:  ${log.processed_count}`);
        console.log(`  - Msg:    ${log.message}`);
        console.log('----------------------------');
    });
}

checkLogs();
