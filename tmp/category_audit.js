const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function categoryAudit() {
    const { data, error } = await supabase
        .rpc('get_category_stats'); // If RPC doesn't exist, we'll fetch manually
    
    if (error) {
        console.log('RPC not found, fetching manually...');
        const { data: all, error: err2 } = await supabase.from('master_places').select('category');
        if (!err2 && all) {
            const counts = {};
            all.forEach(r => {
                const c = r.category || 'NULL';
                counts[c] = (counts[c] || 0) + 1;
            });
            console.log(counts);
        }
    } else {
        console.log(data);
    }
}

categoryAudit();
