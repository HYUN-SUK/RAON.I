const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY
);

async function inspectSchedules() {
    console.log('--- Inspecting user_schedules for Mar 1st (KST) ---');

    // Check-in dates relevant for Mar 1st:
    // D-0: 2026-03-01
    // D-1: 2026-03-02
    // D-4: 2026-03-05 (This is "옥이네")

    const relevantDates = ['2026-03-01', '2026-03-02', '2026-03-05'];

    const { data: schedules, error } = await supabase
        .from('user_schedules')
        .select(`
            id, 
            user_id, 
            campground_name, 
            check_in, 
            notification_d0_sent, 
            notification_d1_sent, 
            notification_d4_sent
        `)
        .in('check_in', relevantDates);

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Found ${schedules.length} relevant schedules:`);
    schedules.forEach(s => {
        console.log(`- User: ${s.user_id}`);
        console.log(`  Campground: ${s.campground_name}`);
        console.log(`  Check-in: ${s.check_in}`);
        console.log(`  Sent Flags: D0:${s.notification_d0_sent}, D1:${s.notification_d1_sent}, D4:${s.notification_d4_sent}`);
    });

    // Also look for ANY notifications created today between 08:30 and 10:00 KST
    const { data: notifs } = await supabase
        .from('notifications')
        .select('id, user_id, event_type, status, created_at')
        .gte('created_at', '2026-02-28T23:30:00Z') // 08:30 KST
        .lte('created_at', '2026-03-01T01:00:00Z') // 10:00 KST
        .order('created_at', { ascending: true });

    console.log('\nNotifications created between 08:30 AM and 10:00 AM KST:');
    console.log(JSON.stringify(notifs, null, 2));
}

inspectSchedules();
