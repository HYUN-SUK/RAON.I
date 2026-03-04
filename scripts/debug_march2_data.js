const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY
);

async function checkTodayData() {
    console.log('--- Deep Dive: March 2nd Activity ---');

    // Check all schedules
    const { data: schedules } = await supabase
        .from('user_schedules')
        .select('id, user_id, campground_name, check_in, notification_d0_sent, notification_d1_sent, notification_d4_sent')
        .gte('created_at', '2026-03-01T00:00:00Z') // Reservations made yesterday or today
        .order('check_in', { ascending: true });

    console.log('\nSchedules created since yesterday:');
    console.log(JSON.stringify(schedules, null, 2));

    // Also check notifications created today (Mar 2 KST)
    const { data: notifs } = await supabase
        .from('notifications')
        .select('id, user_id, event_type, status, created_at, title')
        .gte('created_at', '2026-03-01T15:00:00Z') // March 2nd 00:00 KST
        .order('created_at', { ascending: true });

    console.log('\nNotifications created today (Mar 2 KST):');
    console.log(JSON.stringify(notifs, null, 2));
}

checkTodayData();
