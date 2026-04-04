import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runAudit() {
    console.log('🚀 [RAONAI] 전체 마스터 데이터 적재 현황 감사 시작...');
    
    // 전체 카운트 및 그룹화 데이터 가져오기
    // (참고: 대량 데이터이므로 count('exact')를 활용하되, 그룹별 카운트를 위해 반복 쿼리 수행)
    
    const categories = ['MART', 'RESTAURANT', 'SPOT', 'HOSPITAL', 'PHARMACY', 'GAS_STATION', 'FESTIVAL'];
    
    console.log('\n--------------------------------------------------');
    console.log('| 카테고리       | API 소스                     | 건수      |');
    console.log('--------------------------------------------------');

    for (const cat of categories) {
        const { data, error } = await supabase
            .from('master_places')
            .select('api_source')
            .eq('category', cat);
            
        if (error) continue;

        const counts = data.reduce((acc, r) => {
            acc[r.api_source] = (acc[r.api_source] || 0) + 1;
            return acc;
        }, {});

        for (const [source, count] of Object.entries(counts)) {
            console.log(`| ${cat.padEnd(14)} | ${source.padEnd(28)} | ${count.toLocaleString().padStart(8)} |`);
        }
    }
    
    const { count } = await supabase.from('master_places').select('*', { count: 'exact', head: true });
    console.log('--------------------------------------------------');
    console.log(`| 전체 합계                                     | ${count.toLocaleString().padStart(8)} |`);
    console.log('--------------------------------------------------\n');
}

runAudit();
