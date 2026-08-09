import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllLogsExact() {
    console.log('Fetching ALL logs from automation_logs sorted by created_at DESC...');
    const { data: logs, error } = await supabase
        .from('automation_logs')
        .select('id, job_name, status, processed_count, message, created_at, target_date')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error('Error fetching logs:', error);
        return;
    }

    console.log(`Total logs fetched: ${logs.length}\n`);
    logs.forEach((l, idx) => {
        const utcDate = new Date(l.created_at);
        // Add 9 hours for KST
        const kstDate = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
        const kstStr = kstDate.toISOString().replace('T', ' ').slice(0, 19);

        console.log(`[${idx + 1}] KST: ${kstStr} | UTC: ${l.created_at}`);
        console.log(`    JobName: "${l.job_name}" | Status: ${l.status} | Processed: ${l.processed_count}`);
        console.log(`    Message: ${typeof l.message === 'string' ? l.message.slice(0, 100) : JSON.stringify(l.message).slice(0, 100)}`);
        console.log(`--------------------------------------------------------------------------------`);
    });
}

checkAllLogsExact();
