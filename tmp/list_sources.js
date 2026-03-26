const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function listAllSources() {
    const { data, error } = await supabase
        .from('master_places')
        .select('api_source')
        .eq('category', 'MART');
    
    if (!error && data) {
        const counts = {};
        data.forEach(r => {
            const s = r.api_source || 'NULL';
            counts[s] = (counts[s] || 0) + 1;
        });
        console.log('--- RAW MART SOURCE COUNTS ---');
        console.log(counts);
    }
}

listAllSources();
