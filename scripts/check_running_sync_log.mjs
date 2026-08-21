import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkLatestLog() {
    const { data: logs } = await supabase
        .from('automation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (logs && logs.length > 0) {
        const l = logs[0];
        console.log(`최신 로그 ID: ${l.id} | 시간: ${l.created_at} | Job: ${l.job_name} | status: ${l.status}`);
        console.log(`메시지: ${l.message}`);
    }
}

checkLatestLog().catch(console.error);
