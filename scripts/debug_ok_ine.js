const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY
);

async function findUser() {
    console.log('--- Finding User ---');
    // Using profiles table to find nickname
    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, nickname, full_name')
        .or('nickname.ilike.%옥이네%,full_name.ilike.%옥이네%');

    if (pError) console.error('Profile Error:', pError);
    console.log('Profiles:', profiles);

    let userId = null;
    if (profiles && profiles.length > 0) {
        userId = profiles[0].id;
    } else {
        // Fallback search in user_schedules directly if campground_name or something matches
        console.log('Searching in user_schedules for name patterns...');
        const { data: schedsByName, error: sError } = await supabase
            .from('user_schedules')
            .select('user_id, campground_name')
            .ilike('campground_name', '%옥이네%')
            .limit(5);
        if (schedsByName && schedsByName.length > 0) {
            userId = schedsByName[0].user_id;
            console.log('Found user_id from schedule search:', userId);
        }
    }

    if (userId) {
        console.log(`\n--- Schedules for User ID: ${userId} ---`);
        const { data: schedules, error: sError } = await supabase
            .from('user_schedules')
            .select('*')
            .eq('user_id', userId)
            .order('check_in', { ascending: false });

        if (sError) console.error('Schedule Error:', sError);
        console.log('Schedules:', schedules);

        console.log(`\n--- Notifications for User ID: ${userId} ---`);
        const { data: notifs, error: nError } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);

        if (nError) console.error('Notification Error:', nError);
        console.log('Notifications:', JSON.stringify(notifs, null, 2));
    } else {
        console.log('No user found with name "옥이네". Searching all notifications from today...');
        const todayStr = '2026-03-01';
        const { data: allTodayNotifs, error: anError } = await supabase
            .from('notifications')
            .select('*')
            .gte('created_at', todayStr)
            .order('created_at', { ascending: false });

        if (anError) console.error('All Notifs Error:', anError);
        console.log('All Notifications from Today:', JSON.stringify(allTodayNotifs, null, 2));
    }
}

findUser();
