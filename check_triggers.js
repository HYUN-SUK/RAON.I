const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPgNet() {
    console.log("Checking pg_net status...");

    // We can't query net schema directly via Supabase JS unless we have an RPC or use a raw query if enabled
    // Let's try to see if we can find any evidence in the 'notifications' table about the trigger

    // Actually, let's look at the triggers directly via a query
    const { data: triggers, error } = await supabase.rpc('get_table_triggers', { table_name: 'notifications' });
    if (error) {
        console.log("RPC get_table_triggers failed, trying alternative...");
        // If RPC fails, we might not have a way to see triggers directly without a SQL editor or custom RPC.
        // Let's just try to see if ANY notification was sent recently
        const { data: recent } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(5);
        console.log("Recent notifications and their statuses:");
        recent.forEach(n => console.log(`  - ${n.id}: ${n.status} (${n.created_at})`));
    } else {
        console.log("Triggers on notifications:", triggers);
    }
}
checkPgNet();
