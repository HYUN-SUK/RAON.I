import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testCountMethods() {
    const targetSido = '경기도';
    
    console.log("=== count 방식별 비교 테스트 ===\n");
    
    // Method 1: count: 'planned' (PostgREST 추정)
    console.log("--- Method 1: count='planned' ---");
    const r1 = await supabase.from('master_places').select('*', { count: 'planned', head: true })
        .eq('sido', targetSido).eq('api_source', 'SAFE_RESTAURANT').eq('is_active', true);
    console.log(`SAFE Active (planned): count=${r1.count}, error=${JSON.stringify(r1.error)}, status=${r1.status}`);

    // Method 2: count: 'estimated'
    console.log("\n--- Method 2: count='estimated' ---");
    const r2 = await supabase.from('master_places').select('*', { count: 'estimated', head: true })
        .eq('sido', targetSido).eq('api_source', 'SAFE_RESTAURANT').eq('is_active', true);
    console.log(`SAFE Active (estimated): count=${r2.count}, error=${JSON.stringify(r2.error)}, status=${r2.status}`);

    // Method 3: select id only (no head), count length
    console.log("\n--- Method 3: select id, count array length ---");
    let allIds = [];
    let page = 0;
    const pageSize = 1000;
    while (true) {
        const { data, error } = await supabase.from('master_places').select('id')
            .eq('sido', targetSido).eq('api_source', 'SAFE_RESTAURANT').eq('is_active', true)
            .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) { console.log(`Error: ${error.message}`); break; }
        if (!data || data.length === 0) break;
        allIds.push(...data);
        if (data.length < pageSize) break;
        page++;
    }
    console.log(`SAFE Active (pagination): count=${allIds.length}`);

    // Method 4: exact count with smaller scope to compare
    console.log("\n--- Method 4: count='exact' 소규모 카테고리 ---");
    const r4 = await supabase.from('master_places').select('*', { count: 'exact', head: true })
        .eq('sido', targetSido).eq('api_source', 'CENTURY_SHOP').eq('is_active', true);
    console.log(`백년가게 Active (exact): count=${r4.count}, error=${JSON.stringify(r4.error)}, status=${r4.status}`);
}

testCountMethods();
