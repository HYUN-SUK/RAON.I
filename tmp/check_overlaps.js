const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkOverlaps() {
    const { count, error } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .eq('category', 'MART')
        .ilike('api_source', '%LARGE%')
        .ilike('api_source', '%SUPER%');
    
    if (!error) {
        console.log(`Records with BOTH LARGE and SUPER: ${count} 건`);
    } else {
        console.error(error);
    }
}

checkOverlaps();
