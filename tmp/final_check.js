const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function finalCheck() {
    const { count: total } = await supabase.from('master_places').select('*', { count: 'exact', head: true });
    const { count: martU } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('category', 'MART');
    const { count: martL } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('category', 'mart');
    
    console.log(`Total Table Count: ${total}`);
    console.log(`Category MART: ${martU}`);
    console.log(`Category mart: ${martL}`);
}

finalCheck();
