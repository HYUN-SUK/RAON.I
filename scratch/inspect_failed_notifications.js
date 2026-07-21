const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectFailed() {
    console.log("Fetching failed notifications and error messages...");
    const { data, error } = await supabase
        .from('notifications')
        .select('id, user_id, title, status, created_at, event_type, error_message')
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error fetching failed notifications:", error);
        return;
    }

    console.log("Failed Notifications Details:");
    data.forEach(n => {
        console.log(`- ID: ${n.id}
  Title: ${n.title}
  Event: ${n.event_type}
  CreatedAt: ${n.created_at}
  User: ${n.user_id}
  ErrorMessage: ${n.error_message}
----------------------------------------`);
    });
}

inspectFailed();
