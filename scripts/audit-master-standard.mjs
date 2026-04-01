import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runStandardAudit() {
    console.log("=== [Standard Audit v11.8.5] 주간 배치(Phase 12) 정밀 실측 시작 ===");

    // 1. 최신 배치 로그 확보
    const { data: logs, error: lErr } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('job_name', 'WEEKLY_MASTER_SYNC')
        .order('created_at', { ascending: false })
        .limit(1);

    if (lErr || !logs || logs.length === 0) {
        console.error("  [Error] 배치 실행 로그를 찾을 수 없습니다.");
        return;
    }

    const latest = logs[0];
    const apiStatus = latest.message?.api_status || latest.api_status || [];
    console.log(`\n최근 배치 시각: ${latest.created_at} (KST 기준 약 ${new Date(latest.created_at).toLocaleString('ko-KR', {timeZone:'Asia/Seoul'})})`);
    console.log(`최종 상태: ${latest.status} / 총 처리: ${latest.processed_count}\n`);

    // 2. API별 지표 테이블 생성
    console.log("| 카테고리 | API 출처 | Fetched | Existing | New | Updated | 최종 적재 | 상태 |");
    console.log("| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |");

    const sourceMap = {
        'SMBA_BAEK': 'RESTAURANT',
        'MOIS_GOOD_RESTAURANT': 'RESTAURANT',
        'SAFE_REST': 'RESTAURANT',
        'LOCALDATA_MART_LARGE': 'MART',
        'LOCALDATA_MART_SSM': 'MART',
        'LOCALDATA_MART_OTHER': 'MART',
        'TOUR_SPOT': 'SPOT'
    };

    // DB 실시간 카운트 병렬 조회
    const statsPromises = Object.keys(sourceMap).map(source => 
        supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('api_source', source)
    );
    const results = await Promise.all(statsPromises);
    const dbCounts = Object.keys(sourceMap).reduce((acc, source, idx) => {
        acc[source] = results[idx].count;
        return acc;
    }, {});

    // 로그 데이터 기반 출력
    for (const source of Object.keys(sourceMap)) {
        const stat = apiStatus.find(s => s.name === source) || { fetched_count: '-', existing_count: '-', new_count: '-', updated_count: '-', status: 'SKIPPED' };
        console.log(`| ${sourceMap[source]} | ${source} | ${stat.fetched_count} | ${stat.existing_count} | ${stat.new_count} | ${stat.updated_count} | ${dbCounts[source] || 0} | ${stat.status || 'DONE'} |`);
    }

    // 3. 무결성 정밀 진단 (Critical Checks)
    console.log("\n--- [무결성 정밀 진단] ---");

    // Check A: 안심식당 지정취소 정화 여부 (v11.8.5 패치 검증)
    const { count: inactiveCount } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .eq('api_source', 'SAFE_REST')
        .filter('raw_data->>RELAX_USE_YN', 'eq', 'N');
    console.log(`A. 안심식당 지정취소(N) 잔류 수: ${inactiveCount} 건 (0건이어야 패치 성공)`);

    // Check B: 하이브리드 매핑 엔진 누락 (v11.7 패치 검증)
    const { count: mappingFailCount } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .not('raw_data->>BSNSSP_NM', 'is', null)
        .or('name.eq.,name.is.null');
    console.log(`B. 하이브리드 매핑(BSNSSP_NM) 실패 수: ${mappingFailCount} 건 (0건이어야 패치 성공)`);

    console.log("\n전체 주간 배치 점검이 완료되었습니다.");
}

runStandardAudit();
