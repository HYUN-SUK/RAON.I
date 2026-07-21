const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspect() {
    console.log("Fetching recent notifications from DB...");
    const { data, error } = await supabase
        .from('notifications')
        .select('id, user_id, title, body, status, created_at, event_type, related_id')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error fetching notifications:", error);
        return;
    }

    console.log("Recent 10 Notifications:");
    data.forEach(n => {
        console.log(`- ID: ${n.id}
  Title: ${n.title}
  Event: ${n.event_type}
  Related: ${n.related_id}
  Status: ${n.status}
  CreatedAt: ${n.created_at}
  User: ${n.user_id}
----------------------------------------`);
    });
}

inspect();
