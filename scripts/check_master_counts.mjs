import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTotalCounts() {
    console.log("=== [MASTER_PLACES] 전체 데이터 현황 정밀 조사 ===");
    
    const { data, error } = await supabase
        .from('master_places')
        .select('api_source, category');

    if (error) {
        console.error("DB 조회 에러:", error.message);
        return;
    }

    const summary = {};
    (data || []).forEach(item => {
        const key = `${item.category || 'NULL'}:${item.api_source || 'NULL'}`;
        summary[key] = (summary[key] || 0) + 1;
    });

    console.log("\n[전체 적재 리스트]");
    Object.entries(summary)
        .sort((a,b) => b[1] - a[1]) // 건수 많은 순 정렬
        .forEach(([k, v]) => {
            console.log(`- ${k}: ${v}건`);
        });

    const total = data?.length || 0;
    console.log(`\n총 데이터 수: ${total}건`);
}

checkTotalCounts();
