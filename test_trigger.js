const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// We need postgres client to query pg_trigger, but supabase JS doesn't allow querying pg_catalog directly
// Let's use an RPC if we made one, or we can just try invoking the Edge Function directly to see if it works

async function testFn() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Let's just create a test insert to see if the trigger fires
    const { data, error } = await supabase.from('notifications').insert({
        user_id: '4730be31-30b5-4594-a993-d8f5a7a5e26c', // from user context
        event_type: 'test_trigger',
        category: 'community',
        title: 'Test Trigger',
        body: 'Testing DB trigger',
        status: 'queued'
    }).select().single();

    if (error) {
        console.error("Insert error:", error);
        return;
    }

    console.log("Inserted test notification:", data.id);

    // Wait 3 seconds
    await new Promise(r => setTimeout(r, 3000));

    const { data: check } = await supabase.from('notifications').select('status, result, error_message').eq('id', data.id).single();
    console.log("Status after 3s:", check.status);
    console.log("Result/Error:", check);
}
testFn();
