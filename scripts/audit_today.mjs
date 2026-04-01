import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runAudit() {
    console.log('--- [Phase 12] 주간 배치 정밀 감사 실측 시작 ---');

    console.log('1. API_SOURCE별 실시간 카운트:');
    const { data: rawStats } = await supabase
        .from('master_places')
        .select('api_source');
    
    const counts = {};
    rawStats.forEach(d => counts[d.api_source] = (counts[d.api_source] || 0) + 1);
    console.log(JSON.stringify(counts, null, 2));

    console.log('\n2. 안심식당 필터 무결성 점검 (지정취소 0건이어야 함):');
    const { count: inactiveCount } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .eq('api_source', 'SAFE_REST')
        .filter('raw_data->>RELAX_USE_YN', 'eq', 'N');
    console.log('INACTIVE_SAFE_REST_REMAINING:', inactiveCount);

    console.log('\n3. 하이브리드 매핑 누락 점검 (MOIS_GOOD_RESTAURANT 등):');
    const { count: mappingFailCount } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .not('raw_data->>BSNSSP_NM', 'is', null)
        .or('name.eq.,name.is.null');
    console.log('MAPPING_FAILURE_COUNT:', mappingFailCount);

    console.log('\n4. 오늘 새벽 4시 배치 로그 확인:');
    const { data: logs } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('job_name', 'WEEKLY_MASTER_SYNC')
        .order('created_at', { ascending: false })
        .limit(1);
    
    if (logs?.[0]) {
        console.log('최근 배치 시각:', logs[0].created_at);
        console.log('최종 메시지:', JSON.stringify(logs[0].message, null, 2));
    } else {
        console.log('배치 로그를 찾을 수 없습니다.');
    }
}

runAudit();
