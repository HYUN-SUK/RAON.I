const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing supabase URL or Key");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, email').eq('email', 'tootg@naver.com');
    const userId = profiles && profiles.length > 0 ? profiles[0].id : null;

    if (userId) {
        const { data: schedules, error: sErr } = await supabase.from('user_schedules').select('*').eq('user_id', userId);
        const { data: res, error: rErr } = await supabase.from('reservations').select('*').eq('user_id', userId);
        const { data: notifs, error: nErr } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10);

        // Also check cron details
        const { data: cron, error: cErr } = await supabase.rpc('get_recent_cron_logs'); // this might fail if RPC doesn't exist, we will ignore cErr if so

        const output = {
            user_id: userId,
            schedules: sErr ? { error: sErr } : schedules,
            reservations: rErr ? { error: rErr } : res,
            recent_notifications: nErr ? { error: nErr } : notifs
        };
        fs.writeFileSync('db_check_result.json', JSON.stringify(output, null, 2), 'utf-8');
        console.log("SUCCESS");
    } else {
        console.log("FAIL: USER NOT FOUND");
    }
}

run();
