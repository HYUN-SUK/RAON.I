import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function deepAudit() {
    console.log('\n--- RAONAI Data Integrity Crisis Audit ---');
    
    // 1. SMBA_BAEK 조사
    const { count: baekCount } = await supabase.from('master_places').select('id', { count: 'exact', head: true }).eq('api_source', 'SMBA_BAEK');
    console.log(`- SMBA_BAEK Real DB Count: ${baekCount}`);

    // 2. Mart 소스 분석 (SUPER vs OTHER)
    const { data: martSourceCounts, error: martErr } = await supabase.rpc('get_source_counts'); // IF defined, or use raw select
    const { data: martSummary } = await supabase.from('master_places').select('api_source').ilike('api_source', 'LOCALDATA_MART%');
    const martCountMap = martSummary.reduce((acc, curr) => {
        acc[curr.api_source] = (acc[curr.api_source] || 0) + 1;
        return acc;
    }, {});
    console.log('\n- Mart Distribution:');
    console.table(Object.entries(martCountMap).map(([src, count]) => ({ Source: src, Count: count })));

    // 3. TOUR_SPOT 조사 (실제 개수)
    const { count: spotCount } = await supabase.from('master_places').select('id', { count: 'exact', head: true }).eq('api_source', 'TOUR_SPOT');
    console.log(`- TOUR_SPOT Real DB Count: ${spotCount}`);

    // 4. Sample Check: MART_OTHER 데이터가 MART_SUPER로 들어갔는지 확인
    // 사용자님이 보낸 ZIP(기타식품판매업)의 특징적인 데이터가 SUPER에 있는지 검색
    const { data: superSample } = await supabase.from('master_places')
        .select('name, address, api_source, raw_data')
        .eq('api_source', 'LOCALDATA_MART_SUPER')
        .limit(3);
    console.log('\n- LOCALDATA_MART_SUPER Sample Raw Data:');
    console.log(JSON.stringify(superSample, null, 2));
}

deepAudit();
