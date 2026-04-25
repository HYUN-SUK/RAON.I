import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const s = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkActualSchema() {
    console.log('🔍 DB 실시간 스키마 정보 조회 중...');
    
    // information_schema는 PostgREST 캐시와 상관없이 DB의 현재 상태를 보여줍니다.
    const { data, error } = await s.rpc('get_table_columns', { table_name: 'smart_plan_candidates' });
    
    // 만약 전용 RPC가 없다면 직접 쿼리 (프로젝트에 따라 다를 수 있음)
    // 여기서는 가장 확실한 방법으로 컬럼 하나씩 존재 여부를 체크해봅니다.
    const columns = ['id', 'reservation_id', 'fact_id', 'category', 'name', 'address', 'lat', 'lng', 'quality_score', 'distance_meters', 'penalty_score', 'final_score', 'raw_data'];
    
    console.log(`\n[smart_plan_candidates] 컬럼 체크:`);
    for (const col of columns) {
        const { error: colErr } = await s.from('smart_plan_candidates').select(col).limit(0);
        if (colErr && colErr.message.includes('does not exist')) {
            console.log(`❌ ${col.padEnd(15)} : 없음`);
        } else if (colErr) {
            console.log(`⚠️ ${col.padEnd(15)} : 오류 (${colErr.message})`);
        } else {
            console.log(`✅ ${col.padEnd(15)} : 존재함`);
        }
    }
}

checkActualSchema();
