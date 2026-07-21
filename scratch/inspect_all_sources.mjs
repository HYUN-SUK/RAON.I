import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectAllSources() {
    console.log("=== DB 전체 master_places api_source별 통계 ===");
    
    // pagination 돌기 번거로우니, 그냥 SQL rpc를 호출하거나 count 조회
    // 9개 카테고리 외에 어떤 소스가 있는지 group by로 쿼리하고 싶지만
    // supabase-js에서는 group by를 지원하지 않으므로,
    // select('api_source') 후 JS 단에서 집계합니다. (range 0 to 50000 으로 대략 5만건 스캔)
    
    let offset = 0;
    const limit = 5000;
    const stats = {};
    
    console.log("Fetching up to 50,000 rows to check source names...");
    
    for (let i = 0; i < 10; i++) {
        const { data, error } = await supabase
            .from('master_places')
            .select('api_source')
            .range(offset, offset + limit - 1);
            
        if (error) {
            console.error("조회 에러:", error.message);
            break;
        }
        if (!data || data.length === 0) break;
        
        data.forEach(row => {
            stats[row.api_source] = (stats[row.api_source] || 0) + 1;
        });
        
        offset += limit;
    }
    
    console.log("\n[api_source 별 데이터 분포 (일부 스캔 결과)]:");
    console.log(JSON.stringify(stats, null, 2));
}

inspectAllSources();
