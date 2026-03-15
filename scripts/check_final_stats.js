const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkStats() {
    const sources = ['SMBA_BAEK', 'SAFE_RESTAURANT', 'LOCALDATA_RESTAURANT', 'LOCALDATA_MART'];
    const results = {};
    
    for (const s of sources) {
        const { count, error } = await supabase
            .from('master_places')
            .select('*', { count: 'exact', head: true })
            .ilike('api_source', `%${s}%`);
        
        if (error) {
            console.error(`Error fetching ${s}:`, error);
        } else {
            results[s] = count;
        }
    }
    
    // Check total
    const { count: total } = await supabase.from('master_places').select('*', { count: 'exact', head: true });
    results['TOTAL_UNIQUE_PLACES'] = total;

    console.log('--- FINAL DATA AUDIT REPORT ---');
    console.log(JSON.stringify(results, null, 2));
}

checkStats();
