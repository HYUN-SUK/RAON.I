import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSyncLog() {
    console.log("=== 오늘자 automation_logs 조회 ===");
    
    const todayStr = new Date().toISOString().split('T')[0];
    
    const { data: logs, error } = await supabase
        .from('automation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("로그 조회 에러:", error);
        return;
    }

    if (logs.length === 0) {
        console.log("오늘 기록된 automation_logs가 없습니다.");
        return;
    }

    console.log(`최근 로그 개수: ${logs.length}개`);
    
    for (const log of logs) {
        console.log(`\n--------------------------------------------`);
        console.log(`ID: ${log.id}`);
        console.log(`Task Name: ${log.task_name}`);
        console.log(`Created At: ${log.created_at}`);
        console.log(`Status: ${log.status}`);
        
        // JSON 형태인 payload 또는 logs 출력
        if (log.payload) {
            const payload = log.payload;
            console.log(`Target Region: ${payload.sido || payload.targetSido || 'unknown'}`);
            if (payload.categories) {
                console.log("Categories Status:");
                console.log(JSON.stringify(payload.categories.SAFE || payload.categories, null, 2));
            } else {
                console.log("Payload Sample:", JSON.stringify(payload, null, 2).substring(0, 500));
            }
        }
        if (log.logs && log.logs.length > 0) {
            console.log("Log Snippet (Last 10 lines):");
            const logArr = Array.isArray(log.logs) ? log.logs : String(log.logs).split('\n');
            console.log(logArr.slice(-10).join('\n'));
        }
    }
}

checkSyncLog();
