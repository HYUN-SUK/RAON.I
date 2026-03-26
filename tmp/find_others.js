const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function findOthers() {
    const { data, error } = await supabase
        .from('master_places')
        .select('api_source')
        .eq('category', 'MART')
        .not('api_source', 'ilike', '%LARGE%')
        .not('api_source', 'ilike', '%SUPER%')
        .not('api_source', 'ilike', '%SSM%')
        .limit(20);
    
    if (!error && data) {
        console.log('Sample of unidentified api_sources:', data.map(o => o.api_source));
    } else {
        console.log('Error or no data:', error?.message);
    }
}

findOthers();
