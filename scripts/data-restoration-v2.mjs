import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function restoreIntegrity() {
    console.log('\n--- RAONAI Foundation Restoration (Ground Zero - Paginated) ---');
    
    let allData = [];
    let from = 0;
    const step = 1000;

    // 1. 전수 데이터 수집 (페이징 적용)
    while (true) {
        const { data, error } = await supabase
            .from('master_places')
            .select('id, api_source, category, raw_data')
            .range(from, from + step - 1);
        
        if (error) { console.error('  [Error]', error.message); break; }
        if (!data || data.length === 0) break;
        
        allData = allData.concat(data);
        from += step;
        process.stdout.write(`\r  Fetching DB: ${allData.length}...`);
    }
    console.log('\n  Fetch Complete.');

    // 2. 오적재 데이터 추출 (MART_SUPER -> MART_OTHER 보정)
    // 개방서비스아이디: '07_22_13_P' (기타식품판매업)
    const mislabeled = allData.filter(d => 
        d.api_source === 'LOCALDATA_MART_SUPER' && 
        (d.raw_data?.개방서비스아이디 === '07_22_13_P' || d.raw_data?.original?.[2] === '07_22_13_P')
    );

    console.log(`  -> Found ${mislabeled.length} mislabeled records.`);

    if (mislabeled.length > 0) {
        process.stdout.write('  -> Repairing labels...');
        for (let i = 0; i < mislabeled.length; i += 100) {
            const batch = mislabeled.slice(i, i + 100).map(m => m.id);
            const { error: upErr } = await supabase
                .from('master_places')
                .update({ api_source: 'LOCALDATA_MART_OTHER' })
                .in('id', batch);
            if (upErr) console.error(`\n    [Error at ${i}]`, upErr.message);
        }
        console.log(' DONE.');
    }

    // 3. 최종 통계 산출 (카테고리/소스 별)
    // 갱신된 내역을 반영하기 위해 allData의 api_source 필드 업데이트
    mislabeled.forEach(m => { m.api_source = 'LOCALDATA_MART_OTHER'; });

    const census = allData.reduce((acc, curr) => {
        const key = `${curr.category} | ${curr.api_source}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    console.log('\n--- Final Perfect Census (Ground Zero) ---');
    console.table(Object.entries(census).sort().map(([k, v]) => {
        const [cat, src] = k.split(' | ');
        return { Category: cat, Source: src, Count: v };
    }));
    
    console.log(`\nGRAND TOTAL MASTER PLACES: ${allData.length.toLocaleString()}`);
}

restoreIntegrity();
