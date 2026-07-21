import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFestivalLog() {
    console.log("=== WEEKLY_FESTIVAL_SYNC 로그 조회 ===");
    
    const { data: logs, error } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('job_name', 'WEEKLY_FESTIVAL_SYNC')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("로그 조회 에러:", error);
        return;
    }

    if (logs.length === 0) {
        console.log("WEEKLY_FESTIVAL_SYNC 로그가 없습니다.");
        return;
    }

    console.log(`조회된 로그 개수: ${logs.length}개`);
    for (const log of logs) {
        console.log(`\nID: ${log.id}`);
        console.log(`Created At: ${log.created_at}`);
        console.log(`Status: ${log.status}`);
        console.log(`Message: ${log.message}`);
        console.log(`Duration: ${log.duration_ms} ms`);
    }
}

checkFestivalLog();
