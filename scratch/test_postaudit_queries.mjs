import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testPostAuditQueries() {
    const targetSido = '경기도';
    
    console.log("=== Post-Audit 쿼리 독립 테스트 ===\n");
    
    // 1) SAFE_RESTAURANT Active
    console.log("1) SAFE_RESTAURANT Active:");
    const r1 = await supabase.from('master_places').select('*', { count: 'exact', head: true })
        .eq('sido', targetSido).eq('api_source', 'SAFE_RESTAURANT').eq('is_active', true);
    console.log(`   count=${r1.count}, error=${JSON.stringify(r1.error)}, status=${r1.status}`);

    // 2) SAFE_RESTAURANT Inactive
    console.log("2) SAFE_RESTAURANT Inactive:");
    const r2 = await supabase.from('master_places').select('*', { count: 'exact', head: true })
        .eq('sido', targetSido).eq('api_source', 'SAFE_RESTAURANT').eq('is_active', false);
    console.log(`   count=${r2.count}, error=${JSON.stringify(r2.error)}, status=${r2.status}`);

    // 3) Enrichment Active (raw_data->>operating_hours NOT NULL)
    console.log("3) Enrichment Active (operating_hours NOT NULL):");
    const r3 = await supabase.from('master_places').select('*', { count: 'exact', head: true })
        .eq('sido', targetSido).eq('is_active', true).not('raw_data->>operating_hours', 'is', null);
    console.log(`   count=${r3.count}, error=${JSON.stringify(r3.error)}, status=${r3.status}`);

    // 4) Enrichment Inactive (raw_data->>operating_hours NOT NULL)
    console.log("4) Enrichment Inactive (operating_hours NOT NULL):");
    const r4 = await supabase.from('master_places').select('*', { count: 'exact', head: true })
        .eq('sido', targetSido).eq('is_active', false).not('raw_data->>operating_hours', 'is', null);
    console.log(`   count=${r4.count}, error=${JSON.stringify(r4.error)}, status=${r4.status}`);

    // 5) 전체 경기도 Active (api_source 무관)
    console.log("5) 전체 경기도 Active:");
    const r5 = await supabase.from('master_places').select('*', { count: 'exact', head: true })
        .eq('sido', targetSido).eq('is_active', true);
    console.log(`   count=${r5.count}, error=${JSON.stringify(r5.error)}, status=${r5.status}`);
}

testPostAuditQueries();
