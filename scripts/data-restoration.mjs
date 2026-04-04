import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function restoreIntegrity() {
    console.log('\n--- RAONAI Foundation Restoration (Ground Zero) ---');
    
    // 1. 소스 명칭 복구 (MART_SUPER -> MART_OTHER)
    // 07_22_13_P 코드를 가진 모든 데이터를 명세대로 MART_OTHER로 변경
    const { data: targets, error: fetchErr } = await supabase
        .from('master_places')
        .select('id, raw_data')
        .eq('api_source', 'LOCALDATA_MART_SUPER');
        
    if (fetchErr) { console.error('  [Error Fetching]', fetchErr.message); return; }

    const otherTargets = targets.filter(t => t.raw_data?.개방서비스아이디 === '07_22_13_P' || t.raw_data?.original?.[2] === '07_22_13_P');
    
    console.log(`  -> Found ${otherTargets.length} mislabeled Other Food Store records in SUPER.`);

    if (otherTargets.length > 0) {
        process.stdout.write('  -> Correcting labels...');
        for (let i = 0; i < otherTargets.length; i += 100) {
            const ids = otherTargets.slice(i, i + 100).map(t => t.id);
            const { error: upErr } = await supabase
                .from('master_places')
                .update({ api_source: 'LOCALDATA_MART_OTHER' })
                .in('id', ids);
            if (upErr) console.error(`\n    [Patch Error at ${i}]`, upErr.message);
        }
        console.log(' DONE.');
    }

    // 2. 최종 완결 전수조사 (카테고리/소스별)
    console.log('\n--- Final Perfect Census (Ground Zero) ---');
    const { data: all, error: allErr } = await supabase.from('master_places').select('api_source, category');
    if (allErr) { console.error(allErr.message); return; }

    const census = all.reduce((acc, curr) => {
        const key = `${curr.category} | ${curr.api_source}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    console.table(Object.entries(census).sort().map(([k, v]) => {
        const [cat, src] = k.split(' | ');
        return { Category: cat, Source: src, Count: v };
    }));
    
    console.log(`\nGRAND TOTAL MASTER PLACES: ${all.length.toLocaleString()}`);
}

restoreIntegrity();
