const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listRpcs() {
    // Querying the pg_proc table via a clever select if possible, though rpc usually fails if not public.
    // Actually, we can't query pg_proc directly. 
    // Let's just try to call a few common ones.
    const rpcs = ['exec_sql', 'execute_sql', 'admin_sql', 'query'];
    for (const r of rpcs) {
        const { error } = await supabase.rpc(r, { sql: 'SELECT 1' });
        if (error && !error.message.includes('not found')) {
            console.log(`Found RPC candidate: ${r} (Error: ${error.message})`);
        } else if (!error) {
            console.log(`Found working RPC: ${r}`);
        }
    }
}
listRpcs();
