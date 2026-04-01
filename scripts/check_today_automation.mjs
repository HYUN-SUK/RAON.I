import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const batStartTime = '2026-03-31T19:00:00Z'; // 4/1 04:00 KST
    console.log('--- 주간 배치(4/1 04:00 KST) 실행 여부 정밀 진단 ---');

    // 1. 데이터 업데이트 확인
    const { count: updatedCount } = await s
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', batStartTime);
    console.log(`오늘 새벽 4시 이후 업데이트된 데이터 수: ${updatedCount} 건`);

    // 2. 로그 존재 여부 확인
    const { data: logs } = await s
        .from('automation_logs')
        .select('*')
        .gte('created_at', batStartTime)
        .order('created_at', { ascending: false });
    
    console.log(`오늘 새벽 4시 이후 생성된 로그 건수: ${logs?.length || 0} 건`);
    if (logs && logs.length > 0) {
        logs.forEach(l => console.log(` - [${l.created_at}] Job: ${l.job_name}, Status: ${l.status}`));
    } else {
        console.log('해당 시간대의 로깅 기록이 전무합니다.');
    }

    if (updatedCount > 0) {
        console.log('결론: 배치는 실행되었으나 로깅 시스템에 문제가 발생했을 가능성이 큽니다.');
    } else {
        console.log('결론: 주간 배치 자체가 오늘 새벽에 트리거되지 않았거나 초기 단계에서 Crash되었습니다.');
    }
}

check();
