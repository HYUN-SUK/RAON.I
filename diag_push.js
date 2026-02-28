const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log('--- User Mapping ---');
    const { data: profiles } = await supabase.from('profiles').select('id, email');
    const emailMap = {};
    profiles.forEach(p => emailMap[p.id] = p.email);

    console.log('\n--- Latest Notifications (Last 10) ---');
    const { data: notifications } = await supabase
        .from('notifications')
        .select('id, created_at, user_id, event_type, status, error_message')
        .order('created_at', { ascending: false })
        .limit(10);

    notifications.forEach(n => {
        const email = emailMap[n.user_id] || n.user_id.slice(0, 8);
        console.log(`[${n.created_at}] User:${email} Event:${n.event_type} Status:${n.status}`);
        if (n.error_message) console.log(`  Err: ${n.error_message.slice(0, 100)}`);
    });

    console.log('\n--- Token Health Check ---');
    const { data: allTokens } = await supabase
        .from('push_tokens')
        .select('user_id, token, last_updated_at')
        .order('user_id');

    const tokenGroups = {};
    allTokens.forEach(t => {
        if (!tokenGroups[t.user_id]) tokenGroups[t.user_id] = [];
        tokenGroups[t.user_id].push({ token: t.token.slice(0, 15), updated: t.last_updated_at });
    });

    Object.entries(tokenGroups).forEach(([userId, list]) => {
        const email = emailMap[userId] || userId.slice(0, 8);
        if (list.length > 1) {
            console.log(`User: ${email} has ${list.length} tokens! (CRITICAL - Duplication)`);
            list.forEach(item => console.log(`  - ${item.token}... (Updated: ${item.updated})`));
        } else {
            console.log(`User: ${email} has 1 token: ${list[0].token}... (Updated: ${list[0].updated})`);
        }
    });
}

diagnose();
