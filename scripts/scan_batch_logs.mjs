import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function scanLogs() {
    console.log("=== Last 48h MASTER_SYNC Log Search (KST 기준 3/30 ~ 3/31) ===");
    
    // UTC 3/29 15:00 ~ Now (KST 3/30 00:00 ~ Now)
    const { data: logs, error } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('job_name', 'MASTER_SYNC')
        .gte('created_at', '2026-03-29T15:00:00Z')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Logs fetch error:", error.message);
        return;
    }

    if (!logs || logs.length === 0) {
        console.log("MASTER_SYNC 로그가 전혀 없습니다.");
        return;
    }

    logs.forEach(l => {
        console.log(`\n- ID: ${l.id}`);
        console.log(`- Created (UTC): ${l.created_at}`);
        // KST 변환 (UTC + 9)
        const kst = new Date(new Date(l.created_at).getTime() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').replace('Z', ' KST');
        console.log(`- Created (KST): ${kst}`);
        console.log(`- Status: ${l.status}`);
        console.log(`- Processed: ${l.processed_count}`);
        console.log(`- Message: ${l.message}`);
    });
}

scanLogs();
