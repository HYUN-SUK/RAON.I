import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

const CATEGORIES = ['RESTAURANT', 'MART', 'SPOT', 'FESTIVAL', 'GAS_STATION', 'HOSPITAL', 'PHARMACY'];

async function checkStrike2Fast() {
    console.log('====================================================');
    console.log('🔍 master_places: miss_count = 2 카테고리별 고속 집계');
    console.log('====================================================\n');

    let totalStrike2 = 0;
    const results = [];

    for (const cat of CATEGORIES) {
        const { count, error } = await supabase
            .from('master_places')
            .select('*', { count: 'exact', head: true })
            .eq('category', cat)
            .eq('miss_count', 2);

        if (error) {
            console.error(`Error checking ${cat}:`, error.message);
            continue;
        }

        const cnt = count || 0;
        totalStrike2 += cnt;
        results.push({ category: cat, count: cnt });
    }

    // null / 기타 카테고리
    const { count: uncategorizedCount } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .is('category', null)
        .eq('miss_count', 2);
    
    if (uncategorizedCount && uncategorizedCount > 0) {
        totalStrike2 += uncategorizedCount;
        results.push({ category: '기타/미분류', count: uncategorizedCount });
    }

    console.log(`총 2스트라이크(miss_count = 2) 건수: ${totalStrike2.toLocaleString()}건\n`);
    for (const r of results.sort((a, b) => b.count - a.count)) {
        const pct = totalStrike2 > 0 ? ((r.count / totalStrike2) * 100).toFixed(1) : '0';
        console.log(`- ${r.category.padEnd(15)} : ${r.count.toLocaleString()}건 (${pct}%)`);
    }

    console.log('\n====================================================');
    console.log('🔍 1스트라이크(miss_count = 1) 카테고리별 현황');
    console.log('====================================================\n');

    let totalStrike1 = 0;
    const results1 = [];

    for (const cat of CATEGORIES) {
        const { count } = await supabase
            .from('master_places')
            .select('*', { count: 'exact', head: true })
            .eq('category', cat)
            .eq('miss_count', 1);

        const cnt = count || 0;
        totalStrike1 += cnt;
        results1.push({ category: cat, count: cnt });
    }

    console.log(`총 1스트라이크(miss_count = 1) 건수: ${totalStrike1.toLocaleString()}건\n`);
    for (const r of results1.sort((a, b) => b.count - a.count)) {
        const pct = totalStrike1 > 0 ? ((r.count / totalStrike1) * 100).toFixed(1) : '0';
        console.log(`- ${r.category.padEnd(15)} : ${r.count.toLocaleString()}건 (${pct}%)`);
    }
}

checkStrike2Fast();
