const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function exactAudit() {
    console.log('--- 🛡️ EXACT MART AUDIT ---');
    
    const { count: total } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('category', 'MART');
    const { count: large } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('category', 'MART').ilike('api_source', '%LARGE%');
    const { count: super_m } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('category', 'MART').ilike('api_source', '%SUPER%');
    const { count: ssm } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('category', 'MART').ilike('api_source', '%SSM%');
    const { count: both } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('category', 'MART').ilike('api_source', '%LARGE%').ilike('api_source', '%SUPER%');
    
    console.log(`Total: ${total}`);
    console.log(`Large: ${large}`);
    console.log(`Super: ${super_m}`);
    console.log(`SSM: ${ssm}`);
    console.log(`Both Large/Super: ${both}`);
    
    const unidentified = total - (large + super_m + ssm - both);
    console.log(`Unidentified: ${unidentified}`);

    if (unidentified > 0) {
        // Find one sample unidentified record
        const { data } = await supabase
            .from('master_places')
            .select('api_source, name, address')
            .eq('category', 'MART')
            .not('api_source', 'ilike', '%LARGE%')
            .not('api_source', 'ilike', '%SUPER%')
            .not('api_source', 'ilike', '%SSM%')
            .limit(1);
        
        console.log('Sample Unidentified:', data);
    }
}

exactAudit();
