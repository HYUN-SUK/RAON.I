const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkOldSource() {
    const { count, error } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .eq('api_source', 'LOCALDATA_MART');
    
    if (!error) {
        console.log(`LOCALDATA_MART (Old Name): ${count} 건`);
    } else {
        console.error(error);
    }

    // Also check for any other source starting with LOCALDATA_MART but not LARGE/SSM/SUPER
    const { data: others, error: error2 } = await supabase
        .from('master_places')
        .select('api_source')
        .eq('category', 'MART')
        .not('api_source', 'ilike', '%LARGE%')
        .not('api_source', 'ilike', '%SUPER%')
        .not('api_source', 'ilike', '%SSM%')
        .limit(10);
    
    if (!error2 && others) {
        console.log('Sample of other sources:', others.map(o => o.api_source));
    }
}

checkOldSource();
