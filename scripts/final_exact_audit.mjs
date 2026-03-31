import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllCounts() {
    console.log("=== [MASTER_PLACES] 14.8만 건 정밀 전역 스캔 시작 ===");
    
    // api_source별로 개별 count 쿼리 실행 (Limit 우회)
    const sources = [
        'SMBA_BAEK', 'MOIS_GOOD_RESTAURANT', 'SAFE_REST', 'LOCALDATA_RESTAURANT',
        'LOCALDATA_MART_LARGE', 'LOCALDATA_MART_SSM', 'LOCALDATA_MART_SUPER', 'LOCALDATA_MART_OTHER',
        'TOUR_SPOT', 'TOUR_FSTVL'
    ];

    const results = {};

    for (const src of sources) {
        const { count, error } = await supabase
            .from('master_places')
            .select('*', { count: 'exact', head: true })
            .eq('api_source', src);
        
        if (error) {
            console.error(`- ${src} 조회 실패:`, error.message);
        } else {
            results[src] = count || 0;
        }
    }

    console.log("\n[최종 실측치 보고]");
    Object.entries(results).forEach(([src, count]) => {
        const status = count > 0 ? "✅" : "❌ (없음)";
        console.log(`${status} ${src}: ${count}건`);
    });

    const totalCalculated = Object.values(results).reduce((a, b) => a + b, 0);
    console.log(`\n계산된 필터링 합계: ${totalCalculated}건`);
    
    // 전체 레코드 수 재확인
    const { count: totalExact } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true });
    
    console.log(`DB 실제 전체 건수: ${totalExact}건`);
    
    if (totalExact > totalCalculated) {
        console.log(`\n⚠️ 주의: 위 목록(` + (totalExact - totalCalculated) + `건)에 포함되지 않은 다른 api_source가 존재합니다.`);
    }
}

checkAllCounts();
