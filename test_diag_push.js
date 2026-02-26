const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deepDiag() {
    // 1. Check if the DB trigger actually exists
    const { data: triggers, error: trigErr } = await supabase
        .from('pg_catalog.pg_trigger')  // won't work through REST API
        .select('*');
    // This won't work via REST, so let's use a different approach

    // 2. Manually invoke push-notification to test if it works
    console.log("=== Testing push-notification Edge Function directly ===");

    // Get the latest queued reservation notification
    const { data: latestNotif } = await supabase
        .from('notifications')
        .select('*')
        .eq('status', 'queued')
        .eq('event_type', 'reservation_submitted')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (latestNotif) {
        console.log("Found queued notification:", latestNotif.id, latestNotif.title);

        // Try to invoke push-notification directly
        const { data: pushResult, error: pushErr } = await supabase.functions.invoke('push-notification', {
            body: {
                record: latestNotif
            }
        });

        console.log("Push-notification result:", JSON.stringify(pushResult, null, 2));
        console.log("Push-notification error:", pushErr);
    } else {
        console.log("No queued reservation_submitted notification found");
    }

    // 3. Check if pg_net extension is enabled (via SQL)
    // Can't do raw SQL via REST API, but we can check the _net schema
    const { data: netCheck, error: netErr } = await supabase
        .from('net._http_response')
        .select('id')
        .limit(1);
    console.log("\npg_net _http_response table check:", netErr ? `Error: ${netErr.message}` : "Accessible");

    // 4. Check recent push-notification function logs by looking at Supabase Edge Function logs
    console.log("\n=== Check Supabase Dashboard > Edge Functions > push-notification > Logs for errors ===");
}

deepDiag();
