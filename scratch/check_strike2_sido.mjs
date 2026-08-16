import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

// 17개 시도별로 조회하면 각각 1만건 미만이라 인덱스 없이도 즉시 통과
const SIDO_LIST = [
    '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시',
    '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도',
    '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도'
];

async function checkBySido() {
    console.log('====================================================');
    console.log('🔍 17개 시도 분할 조회로 miss_count = 2 카테고리 전수 집계');
    console.log('====================================================\n');

    const catCounts = {
        RESTAURANT: 0,
        MART: 0,
        SPOT: 0,
        FESTIVAL: 0,
        GAS_STATION: 0,
        HOSPITAL: 0,
        PHARMACY: 0,
        OTHER: 0
    };

    let total2 = 0;

    for (const sido of SIDO_LIST) {
        // sido별로 miss_count = 2 조회
        const { data, error } = await supabase
            .from('master_places')
            .select('category')
            .eq('sido', sido)
            .eq('miss_count', 2);

        if (error) {
            console.error(`[${sido}] Error:`, error.message);
            continue;
        }

        if (data) {
            for (const r of data) {
                const c = r.category || 'OTHER';
                catCounts[c] = (catCounts[c] || 0) + 1;
                total2++;
            }
        }
    }

    console.log(`\n🎉 전수 집계 완료! 총 2스트라이크 건수: ${total2.toLocaleString()}건\n`);
    for (const [cat, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
        const pct = total2 > 0 ? ((count / total2) * 100).toFixed(1) : '0';
        console.log(`- ${cat.padEnd(15)} : ${count.toLocaleString()}건 (${pct}%)`);
    }
}

checkBySido();
