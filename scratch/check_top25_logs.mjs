import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTop25Logs() {
    console.log('Fetching TOP 25 logs...');
    const { data: logs, error } = await supabase
        .from('automation_logs')
        .select('id, job_name, status, processed_count, message, created_at, target_date')
        .order('created_at', { ascending: false })
        .limit(25);

    if (error) {
        console.error('Error fetching logs:', error);
        return;
    }

    logs.forEach((l, idx) => {
        const utcDate = new Date(l.created_at);
        const kstDate = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
        const kstStr = kstDate.toISOString().replace('T', ' ').slice(0, 19);

        console.log(`[${idx + 1}] KST: ${kstStr} | Job: "${l.job_name}"`);
        console.log(`    Message: ${l.message}`);
    });
}

checkTop25Logs();
