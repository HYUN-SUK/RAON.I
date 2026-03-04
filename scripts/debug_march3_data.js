const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY
);

async function checkMarch3Data() {
    console.log('--- Diagnostic: March 3rd Activity ---');

    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 3600000);
    const todayStr = kst.toISOString().split('T')[0];

    // 1. Check Schedules created since March 2nd (yesterday)
    const { data: schedules } = await supabase
        .from('user_schedules')
        .select('id, user_id, campground_name, check_in, notification_d0_sent, notification_d1_sent, notification_d4_sent')
        .gte('created_at', '2026-03-02T00:00:00Z')
        .order('check_in', { ascending: true });

    console.log(`\n1. Schedules created since Mar 2nd: ${schedules?.length || 0}`);
    console.log(JSON.stringify(schedules, null, 2));

    // 2. Check Notifications created today (Mar 3 KST) -> >= Mar 2 15:00 UTC
    const { data: notifs } = await supabase
        .from('notifications')
        .select('id, user_id, event_type, status, created_at, title, error_message')
        .gte('created_at', '2026-03-02T15:00:00Z')
        .order('created_at', { ascending: true });

    console.log(`\n2. Notifications created today (Mar 3 KST): ${notifs?.length || 0}`);
    console.log(JSON.stringify(notifs, null, 2));

    // 3. Check Weather Cache updates today
    const { data: weatherCache } = await supabase
        .from('weather_cache')
        .select('nx, ny, updated_at')
        .gte('updated_at', '2026-03-02T15:00:00Z');

    console.log(`\n3. Weather Cache updated today (Mar 3 KST): ${weatherCache?.length || 0}`);
    console.log(JSON.stringify(weatherCache, null, 2));

    // 4. Check Nearby Events Cache updates today
    const { data: nearbyCache } = await supabase
        .from('nearby_cache')
        .select('region_code, base_date, created_at')
        .gte('created_at', '2026-03-02T15:00:00Z');

    console.log(`\n4. Nearby Cache updated today (Mar 3 KST): ${nearbyCache?.length || 0}`);
    console.log(JSON.stringify(nearbyCache, null, 2));
}

checkMarch3Data();
