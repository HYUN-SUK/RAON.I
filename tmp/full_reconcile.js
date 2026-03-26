const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fullReconciliation() {
    console.log('--- 🛡️ FULL MART RECONCILIATION ---');
    
    let allRecords = [];
    let offset = 0;
    const limit = 1000;
    
    while (true) {
        const { data, error } = await supabase
            .from('master_places')
            .select('api_source')
            .eq('category', 'MART')
            .range(offset, offset + limit - 1);
        
        if (error) {
            console.error('Fetch error:', error);
            break;
        }
        if (!data || data.length === 0) break;
        
        allRecords.push(...data);
        offset += limit;
        process.stdout.write(`\rLoaded ${allRecords.length} records...`);
        if (data.length < limit) break;
    }
    
    console.log(`\n\nTotal Records Fetched: ${allRecords.length}`);
    const counts = {};
    allRecords.forEach(r => {
        const s = r.api_source || 'NULL';
        counts[s] = (counts[s] || 0) + 1;
    });
    
    console.log('\n--- 📂 FULL API SOURCE BREAKDOWN ---');
    Object.entries(counts).sort((a,b) => b[1] - a[1]).forEach(([s, c]) => {
        console.log(`${s}: ${c.toLocaleString()} 건`);
    });
}

fullReconciliation();
