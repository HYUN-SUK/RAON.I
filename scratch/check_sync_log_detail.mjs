import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDetail() {
    console.log("=== 특정 automation_log 상세 분석 ===");
    const ids = ['a1146ead-e117-4991-b461-9c7bfb36288c', 'e810e8df-e6f5-437c-9351-6e72a53e3dcf', 'ac041607-6d33-49aa-81a6-8854a3dee6b5'];
    
    for (const id of ids) {
        const { data: log, error } = await supabase
            .from('automation_logs')
            .select('id, job_name, status, processed_count, message, duration_ms, api_status, created_at')
            .eq('id', id)
            .single();

        if (error) {
            console.error(`에러 (${id}):`, error);
            continue;
        }

        console.log(`\n============================================`);
        console.log(`ID: ${log.id}`);
        console.log(`Job Name: ${log.job_name}`);
        console.log(`Created At: ${log.created_at}`);
        console.log(`Status: ${log.status}`);
        console.log(`Processed Count: ${log.processed_count}`);
        console.log(`Message: ${log.message}`);
        
        console.log("\n[API Status 상세]");
        console.log(JSON.stringify(log.api_status, null, 2).substring(0, 1000)); // 너무 길면 잘리게 방지
    }
}

checkDetail();
