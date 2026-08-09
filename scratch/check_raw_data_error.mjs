import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRawDataError() {
    console.log('Fetching raw_data and detailed errors from 8/3 & 8/4 DAILY_REGION_SYNC logs...');
    
    const { data: logs, error } = await supabase
        .from('automation_logs')
        .select('id, job_name, message, api_status, raw_data, created_at')
        .eq('job_name', 'DAILY_REGION_SYNC')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error(error);
        return;
    }

    logs.forEach(l => {
        const utcDate = new Date(l.created_at);
        const kstDate = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
        const kstStr = kstDate.toISOString().replace('T', ' ').slice(0, 19);

        console.log(`\n========================================`);
        console.log(`KST: ${kstStr} | Message: ${l.message}`);
        console.log(`Raw Data structure keys:`, l.raw_data ? Object.keys(l.raw_data) : 'null');
        if (l.raw_data) {
            console.log(`Raw Data:`, JSON.stringify(l.raw_data, null, 2).slice(0, 1000));
        }
        
        // Find hospital error details
        if (Array.isArray(l.api_status)) {
            const h = l.api_status.find(s => s.name === 'HOSPITAL');
            if (h) {
                console.log(`Hospital API Status Detail:`, JSON.stringify(h, null, 2));
            }
        }
    });
}

checkRawDataError();
