const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function deepAudit() {
    console.log('--- 🛡️ DEEP MART AUDIT ---');
    
    // 1. Total MART category count
    const { count: martTotal } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .eq('category', 'MART');
    
    console.log(`Total MART Category: ${martTotal?.toLocaleString()} 건`);
    
    // 2. Breakdown by api_source
    const { data: sources, error } = await supabase
        .from('master_places')
        .select('api_source')
        .eq('category', 'MART');
    
    if (!error && sources) {
        const counts = {};
        sources.forEach(r => {
            const s = r.api_source || 'NULL';
            counts[s] = (counts[s] || 0) + 1;
        });
        console.log('\n--- 📂 API SOURCE BREAKDOWN (MART ONLY) ---');
        Object.entries(counts).forEach(([s, c]) => {
            console.log(`${s}: ${c.toLocaleString()} 건`);
        });
    }

    // 3. Check for recent additions today
    const today = new Date().toISOString().split('T')[0];
    const { count: freshCount } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today);
    
    console.log(`\nNewly added today (total): ${freshCount?.toLocaleString()} 건`);
}

deepAudit();
