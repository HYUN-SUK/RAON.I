import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function checkStrike2Categories() {
    console.log('====================================================');
    console.log('🔍 master_places: miss_count = 2 (2스트라이크) 카테고리별 현황 점검');
    console.log('====================================================\n');

    // 1. miss_count = 2 카테고리별 집계
    const { data: strike2Data, error } = await supabase
        .from('master_places')
        .select('category, is_active')
        .eq('miss_count', 2);

    if (error) {
        console.error('Error fetching strike 2 data:', error);
        return;
    }

    const catCounts = {};
    for (const r of strike2Data) {
        const cat = r.category || 'UNKNOWN';
        catCounts[cat] = (catCounts[cat] || 0) + 1;
    }

    console.log(`총 2스트라이크(miss_count = 2) 건수: ${strike2Data.length}건\n`);
    console.log('카테고리별 분포:');
    for (const [cat, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
        const pct = ((count / strike2Data.length) * 100).toFixed(1);
        console.log(`- ${cat.padEnd(15)} : ${count.toLocaleString()}건 (${pct}%)`);
    }

    // 2. miss_count = 1 도 같이 확인
    const { data: strike1Data } = await supabase
        .from('master_places')
        .select('category')
        .eq('miss_count', 1);

    const cat1Counts = {};
    for (const r of (strike1Data || [])) {
        const cat = r.category || 'UNKNOWN';
        cat1Counts[cat] = (cat1Counts[cat] || 0) + 1;
    }
    console.log(`\n(참고) 1스트라이크(miss_count = 1) 총 건수: ${strike1Data?.length || 0}건`);
    for (const [cat, count] of Object.entries(cat1Counts).sort((a, b) => b[1] - a[1])) {
        const pct = ((count / (strike1Data?.length || 1)) * 100).toFixed(1);
        console.log(`- ${cat.padEnd(15)} : ${count.toLocaleString()}건 (${pct}%)`);
    }
}

checkStrike2Categories();
