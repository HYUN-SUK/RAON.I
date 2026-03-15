const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function finalAudit() {
    const sources = [
        'SMBA_BAEK', 
        'SAFE_RESTAURANT', 'MOIS_SAFE_RESTAURANT',
        'LOCALDATA_RESTAURANT', 'MOIS_GOOD_RESTAURANT',
        'LOCALDATA_MART',
        'TOUR_SPOT'
    ];
    const report = {};
    
    for (const s of sources) {
        const { count, error } = await supabase
            .from('master_places')
            .select('*', { count: 'exact', head: true })
            .ilike('api_source', `%${s}%`);
        
        report[s] = error ? 'Error: ' + error.message : count;
    }
    
    const { count: total } = await supabase.from('master_places').select('*', { count: 'exact', head: true });
    const { count: nullSources } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).is('api_source', null);
    
    report['NULL_API_SOURCE'] = nullSources;
    report['TOTAL_UNIQUE_RECORDS'] = total;
    
    console.log('--- NATIONWIDE SYNC FINAL AUDIT (v2) ---');
    console.log(JSON.stringify(report, null, 2));
}

finalAudit();
