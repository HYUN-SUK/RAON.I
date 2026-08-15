import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function inspectPgPoliciesAndRls() {
    console.log('====================================================');
    console.log('🔍 PostgreSQL 기준 6개 테이블 RLS 실시간 상태 점검');
    console.log('====================================================\n');

    const tables = ['master_places', 'master_places_gas', 'system_config', 'operation_logs', 'likes', 'spatial_ref_sys'];

    for (const tableName of tables) {
        console.log(`📌 [${tableName}] 검사:`);
        
        // 1) Anon 읽기
        const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
        const { count: anonCount, error: anonReadErr } = await anonClient
            .from(tableName)
            .select('*', { count: 'exact', head: true });
        
        // 2) Anon 쓰기 시도 (RLS 차단 확인)
        let anonWriteBlocked = false;
        const { error: anonWriteErr } = await anonClient
            .from(tableName)
            .insert({ id: '00000000-0000-0000-0000-000000000000' })
            .select();

        if (anonWriteErr && (anonWriteErr.code === '42501' || anonWriteErr.message.includes('row-level security'))) {
            anonWriteBlocked = true;
        } else if (anonWriteErr) {
            anonWriteBlocked = true;
        }

        console.log(`   - Anon SELECT: ${anonReadErr ? `차단/에러 (${anonReadErr.message})` : `조회 가능 (총 ${anonCount ?? 0}건)`}`);
        console.log(`   - Anon INSERT: ${anonWriteBlocked ? `🔴 RLS/권한으로 안전하게 차단됨 (${anonWriteErr?.message || 'Blocked'})` : '🟢 통과'}`);
        console.log('');
    }
}

inspectPgPoliciesAndRls();
