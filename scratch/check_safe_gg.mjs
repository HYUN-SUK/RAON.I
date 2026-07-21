import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSafeGG() {
    console.log("=== 경기도 SAFE_RESTAURANT 데이터 분석 ===");
    
    // 1. 경기도 전체 SAFE_RESTAURANT 개수 조회
    const { count, error } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .eq('sido', '경기도')
        .eq('api_source', 'SAFE_RESTAURANT');

    if (error) {
        console.error("조회 에러:", error);
        return;
    }

    console.log(`경기도에 등록된 SAFE_RESTAURANT 개수: ${count}건`);

    // 2. 만약 개수가 0이라면, sido가 다른 이름으로 들어가 있는지 확인
    if (count === 0) {
        console.log("\nsido가 '경기' 혹은 다른 명칭인 SAFE_RESTAURANT가 있는지 확인합니다.");
        const { data: sidoList, error: err2 } = await supabase
            .from('master_places')
            .select('sido')
            .eq('api_source', 'SAFE_RESTAURANT');
            
        if (err2) {
            console.error("Sido 리스트 조회 에러:", err2.message);
            return;
        }

        const sidoMap = {};
        sidoList.forEach(item => {
            sidoMap[item.sido] = (sidoMap[item.sido] || 0) + 1;
        });

        console.log("SAFE_RESTAURANT의 시도별 분포:");
        console.log(JSON.stringify(sidoMap, null, 2));
    } else {
        // 3. 몇 개 샘플 데이터 확인
        const { data: samples, error: err3 } = await supabase
            .from('master_places')
            .select('id, name, address, sido, sigungu, is_active')
            .eq('sido', '경기도')
            .eq('api_source', 'SAFE_RESTAURANT')
            .limit(5);

        if (err3) {
            console.error("샘플 조회 에러:", err3.message);
            return;
        }
        console.log("\n샘플 데이터:");
        console.log(JSON.stringify(samples, null, 2));
    }
}

checkSafeGG();
