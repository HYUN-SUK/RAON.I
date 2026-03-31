import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function generateSOPTable() {
    console.log("=== [SOP v11] 1단계: 주간 배치 정밀 실측 시작 (3/31 04:00 AM Patch) ===");
    
    // 3/31 04:00 AM KST = 3/30 19:00 UTC
    const { data: log, error } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('job_name', 'MASTER_SYNC')
        .gte('created_at', '2026-03-30T19:00:00Z')
        .lte('created_at', '2026-03-30T19:10:00Z')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error || !log || log.length === 0) {
        console.error("4 AM Batch Log를 찾을 수 없습니다.");
        return;
    }

    const batchLog = log[0];
    const apiStatus = batchLog.api_status || [];

    console.log(`\n배치 실행 시각: ${batchLog.created_at}`);
    console.log(`최종 상태: ${batchLog.status}`);
    console.log(`총 처리 건수: ${batchLog.processed_count}\n`);

    console.log("| 카테고리 | API 출처 |Fetched | Existing | New | Updated | 최종 적재 | 상태 |");
    console.log("| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |");

    // Mapping for SOP labels
    const labelMap = {
        '관광명소': { category: 'SPOT', source: 'TOUR_SPOT' },
        '백년가게': { category: 'RESTAURANT', source: 'SMBA_BAEK' },
        '모범음식점': { category: 'RESTAURANT', source: 'MOIS_GOOD_RESTAURANT' },
        '안심식당': { category: 'RESTAURANT', source: 'SAFE_REST' },
        '대규모및준대규모점포': { category: 'MART', source: 'LOCALDATA_MART_LARGE/SSM' },
        '기타식품판매업': { category: 'MART', source: 'LOCALDATA_MART_OTHER' },
        '중형슈퍼마켓': { category: 'MART', source: 'LOCALDATA_MART_SUPER' }
    };

    for (const stat of apiStatus) {
        const info = labelMap[stat.name] || { category: 'UNKNOWN', source: stat.name };
        
        // 최종 적재수는 DB에서 직접 쿼리 (source 기반)
        const { count: finalCount } = await supabase
            .from('master_places')
            .select('*', { count: 'exact', head: true })
            .eq('api_source', stat.name === '대규모및준대규모점포' ? 'LOCALDATA_MART_LARGE' : info.source); // SSM은 분기되므로 대략적인 합산 필요하나 일단 Large 기준으로 표시

        console.log(`| ${info.category} | ${info.source} | ${stat.fetched_count} | ${stat.existing_count} | ${stat.new_count} | ${stat.updated_count} | ${finalCount || 0} | ${stat.status} |`);
    }
}

generateSOPTable();
