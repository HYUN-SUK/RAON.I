const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTriggers() {
    console.log("Checking DB triggers on 'notifications' table...");

    // We'll use a test insert to see if the trigger modifies the record or logs something
    // But first, let's see if we can find the trigger definition via a clever query if possible
    // Actually, let's just test the 'queued' notifications from this morning.

    const { data: queued, error: qError } = await supabase
        .from('notifications')
        .select('*')
        .eq('status', 'queued')
        .limit(1);

    if (qError) {
        console.error("Fetch error:", qError);
        return;
    }

    if (!queued || queued.length === 0) {
        console.log("No queued notifications found to test.");
        return;
    }

    const testNotif = queued[0];
    console.log(`Testing with notification ID: ${testNotif.id}, Event: ${testNotif.event_type}`);

    // Manually invoke the function to see if the function itself is healthy in THIS rolled-back state
    console.log("Manually invoking 'push-notification' for this record...");
    const { data: pushResult, error: invokeError } = await supabase.functions.invoke('push-notification', {
        body: { record: testNotif }
    });

    if (invokeError) {
        console.error("Manual invocation failed:", invokeError);
    } else {
        console.log("Manual invocation result:", JSON.stringify(pushResult, null, 2));
    }

    // Now check the status again after a few seconds
    console.log("Waiting for status update...");
    await new Promise(r => setTimeout(r, 5000));

    const { data: updated } = await supabase
        .from('notifications')
        .select('status, error_message')
        .eq('id', testNotif.id)
        .single();

    console.log("Status after manual push:", updated.status);
    console.log("Error Message:", updated.error_message);
}

checkTriggers();
