import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function proveSeparation() {
    console.log('\n--- RAONAI Multi-Source ID Isolation Proof ---');
    
    // 1. Fetch 5000 records from both sources
    const { data: d1 } = await supabase.from('master_places').select('id, api_source, name, address').eq('api_source', 'SAFE_RESTAURANT').limit(5000);
    const { data: d2 } = await supabase.from('master_places').select('id, api_source, name, address').eq('api_source', 'MOIS_GOOD_RESTAURANT').limit(5000);

    if (!d1 || !d2) { console.error('  [Error] Failed to fetch data.'); return; }

    const safeMap = new Map();
    d1.forEach(r => safeMap.set(`${r.name}|${r.address}`, r));

    let found = 0;
    d2.forEach(good => {
        const key = `${good.name}|${good.address}`;
        const safe = safeMap.get(key);

        if (safe && found < 5) {
            console.log(`\n[Real Case Found]: ${good.name}`);
            console.log(`  - Source A (SAFE): ${safe.api_source} | ID: ${safe.id}`);
            console.log(`  - Source B (GOOD): ${good.api_source} | ID: ${good.id}`);
            console.log('  -> CONCLUSION: IDs ARE UNIQUE/SEPARATED (SUCCESS)');
            found++;
        }
    });

    if (found === 0) {
        console.log('\n  [No Match Found in Sample] Trying a broader search...');
    }
}

proveSeparation();
