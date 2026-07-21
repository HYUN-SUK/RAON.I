import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function deepDiveGG() {
    console.log("=== 경기도 SAFE_RESTAURANT 데이터 생성/수정 타임스탬프 분석 ===");
    
    // 1. created_at 별로 데이터 개수 카운트 (날짜별 분포 확인)
    const { data: list, error } = await supabase
        .from('master_places')
        .select('created_at, updated_at, is_active')
        .eq('sido', '경기도')
        .eq('api_source', 'SAFE_RESTAURANT');

    if (error) {
        console.error("에러:", error.message);
        return;
    }

    console.log(`전체 데이터 수: ${list.length}건`);

    const createdStats = {};
    const updatedStats = {};
    let activeCount = 0;
    let inactiveCount = 0;

    list.forEach(item => {
        if (item.is_active) activeCount++; else inactiveCount++;

        const cDate = item.created_at ? item.created_at.substring(0, 10) : 'unknown';
        const uDate = item.updated_at ? item.updated_at.substring(0, 10) : 'unknown';

        createdStats[cDate] = (createdStats[cDate] || 0) + 1;
        updatedStats[uDate] = (updatedStats[uDate] || 0) + 1;
    });

    console.log(`\nis_active 상태 분포: Active=${activeCount}건, Inactive=${inactiveCount}건`);

    console.log("\n[생성일자(created_at) 분포]:");
    console.log(JSON.stringify(createdStats, null, 2));

    console.log("\n[수정일자(updated_at) 분포]:");
    console.log(JSON.stringify(updatedStats, null, 2));

    // 2. 혹시 'api_source'가 SAFE_RESTAURANT가 아니라 다른 이름으로 저장되어 있는 경기도 데이터가 있는지 확인
    const { data: sourceList, error: err2 } = await supabase
        .from('master_places')
        .select('api_source')
        .eq('sido', '경기도')
        .like('api_source', '%SAFE%');
        
    if (!err2 && sourceList) {
        const sourceMap = {};
        sourceList.forEach(s => {
            sourceMap[s.api_source] = (sourceMap[s.api_source] || 0) + 1;
        });
        console.log("\n[경기도 내 SAFE가 포함된 api_source 목록]:");
        console.log(JSON.stringify(sourceMap, null, 2));
    }
}

deepDiveGG();
