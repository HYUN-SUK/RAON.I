const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function find666() {
    const { data, error } = await supabase
        .from('master_places')
        .select('api_source')
        .eq('category', 'MART');
    
    if (!error && data) {
        const counts = {};
        data.forEach(r => {
            const s = r.api_source || 'NULL';
            if (s !== 'LOCALDATA_MART_LARGE' && s !== 'LOCALDATA_MART_SUPER') {
                counts[s] = (counts[s] || 0) + 1;
            }
        });
        console.log('--- UNKNOWN MART SOURCES ---');
        console.log(counts);
    }
}

find666();
