import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAutomationLogs() {
    console.log('Fetching automation_logs from DB...');
    const { data: logs, error } = await supabase
        .from('automation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

    if (error) {
        console.error('Error fetching logs:', error);
        return;
    }

    console.log(`Total logs fetched: ${logs.length}`);
    logs.forEach(l => {
        console.log(`\n----------------------------------------`);
        console.log(`ID: ${l.id} | Job: ${l.job_name} | Status: ${l.status}`);
        console.log(`CreatedAt (UTC): ${l.created_at} | TargetDate: ${l.target_date}`);
        console.log(`Message: ${l.message}`);
        if (Array.isArray(l.api_status)) {
            console.log(`ApiStatus length: ${l.api_status.length}`);
            const h = l.api_status.find(a => a.name === 'HOSPITAL' || a.name === 'HOSPITAL_NMC');
            if (h) console.log(`HOSPITAL status:`, h);
        } else if (l.api_status) {
            console.log(`ApiStatus is object:`, JSON.stringify(l.api_status).slice(0, 200));
        }
    });
}

checkAutomationLogs();
