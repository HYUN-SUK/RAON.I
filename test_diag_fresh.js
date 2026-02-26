const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diag() {
    const today = '2026-02-26T00:00:00Z';
    console.log(`Checking notifications created today (${today})...\n`);

    // Check today's notifications
    const { data: notifs, error } = await supabase
        .from('notifications')
        .select('id, event_type, title, status, created_at, sent_at')
        .gte('created_at', today)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("DB Query Error:", error.message);
        return;
    }

    console.log(`Found ${notifs.length} notifications created today.`);

    const statusCounts = {};
    notifs.forEach(n => {
        statusCounts[n.status] = (statusCounts[n.status] || 0) + 1;
        if (n.event_type.includes('upcoming_stay')) {
            console.log(`  - [${n.status}] ${n.event_type}: ${n.title}`);
        }
    });

    console.log("\nSummary by Status:", statusCounts);
}

diag();
