const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY
);

async function deepDive() {
    console.log('--- Deep Dive: March 1st Activity ---');

    // 1. All schedules for Mar 1-10
    const { data: schedules } = await supabase
        .from('user_schedules')
        .select('id, user_id, campground_name, check_in, notification_d0_sent, notification_d1_sent, notification_d4_sent')
        .gte('check_in', '2026-03-01')
        .lte('check_in', '2026-03-10')
        .order('check_in', { ascending: true });

    console.log('\nSchedules (Mar 1-10):');
    console.log(JSON.stringify(schedules, null, 2));

    // 2. All notifications created today (UTC 2026-03-01 00:00 to now)
    const { data: notifs } = await supabase
        .from('notifications')
        .select('id, user_id, event_type, status, created_at, title')
        .gte('created_at', '2026-03-01T00:00:00Z')
        .order('created_at', { ascending: true });

    console.log('\nNotifications created today (UTC):');
    console.log(JSON.stringify(notifs, null, 2));

    // 3. Profiles for these users to find "옥이네" or others
    const userIds = [...new Set(schedules.map(s => s.user_id))];
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', userIds);

    console.log('\nUser Profiles:');
    console.log(JSON.stringify(profiles, null, 2));
}

deepDive();
