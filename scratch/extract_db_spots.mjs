import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function extractAllSpots() {
    console.log("=== [MASTER_PLACES] 전체 명소 데이터 추출 시작 ===");
    
    // 1. 정확한 Count 확인
    const { count, error: countError } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .eq('category', 'SPOT');

    if (countError) {
        console.error("Count 조회 에러:", countError.message);
        return;
    }

    console.log(`- SPOT 카테고리 실제 데이터 건수: ${count}건`);

    // 2. 페이지네이션을 통한 전체 추출
    let allSpots = [];
    const pageSize = 1000;
    const totalPages = Math.ceil(count / pageSize);

    for (let i = 0; i < totalPages; i++) {
        process.stdout.write(`- 데이터 가져오는 중... (${i + 1}/${totalPages})\r`);
        const { data, error } = await supabase
            .from('master_places')
            .select('name, address, sido, sigungu')
            .eq('category', 'SPOT')
            .range(i * pageSize, (i + 1) * pageSize - 1);
        
        if (error) {
            console.error(`\n${i}페이지 조회 에러:`, error.message);
            break;
        }
        allSpots = allSpots.concat(data);
    }

    // 3. 파일로 저장
    fs.writeFileSync('scratch/db_spot_list.json', JSON.stringify(allSpots, null, 2));
    console.log(`\n\n=== 추출 완료: scratch/db_spot_list.json (${allSpots.length}건) ===`);
}

extractAllSpots();
