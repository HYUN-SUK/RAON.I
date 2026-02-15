
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function setupTestSchedules() {
    try {
        console.log("Setting up test schedules...");

        // 1. Get User ID (latest schedule)
        const { data: latestSchedule } = await supabase
            .from('user_schedules')
            .select('user_id')
            .limit(1)
            .order('created_at', { ascending: false })
            .single();

        const userId = latestSchedule?.user_id;
        if (!userId) { console.error("No user found."); return; }

        // 2. Dates
        const now = new Date();
        const kstOffset = 9 * 60 * 60 * 1000;
        const kstDate = new Date(now.getTime() + kstOffset);
        const today = kstDate.toISOString().split('T')[0];

        const tomorrowDate = new Date(kstDate);
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrow = tomorrowDate.toISOString().split('T')[0];

        const d4Date = new Date(kstDate);
        d4Date.setDate(d4Date.getDate() + 4);
        const d4 = d4Date.toISOString().split('T')[0];

        // 3. Cleanup
        const testCampgrounds = ['[TEST] D-Day Camping', '[TEST] D-1 Camping', '[TEST] D-4 Camping'];
        await supabase.from('user_schedules').delete().eq('user_id', userId).in('campground_name', testCampgrounds);

        // 4. Insert
        const schedules = [
            {
                user_id: userId,
                campground_name: '[TEST] D-Day Camping',
                check_in: today,
                check_out: tomorrow,
                campground_lat: 37.5665,
                campground_lng: 126.9780,
                status: 'scheduled',
                member_count: 2,
                notification_d0_sent: false,
                notification_d1_sent: false,
                notification_d4_sent: false
            },
            {
                user_id: userId,
                campground_name: '[TEST] D-1 Camping',
                check_in: tomorrow,
                check_out: d4,
                campground_lat: 35.1796,
                campground_lng: 129.0756,
                status: 'scheduled',
                member_count: 4,
                notification_d0_sent: false,
                notification_d1_sent: false,
                notification_d4_sent: false
            },
            {
                user_id: userId,
                campground_name: '[TEST] D-4 Camping',
                check_in: d4,
                check_out: new Date(d4Date.getTime() + 86400000).toISOString().split('T')[0],
                campground_lat: 33.4996,
                campground_lng: 126.5312,
                status: 'scheduled',
                member_count: 1,
                notification_d0_sent: false,
                notification_d1_sent: false,
                notification_d4_sent: false
            }
        ];

        const { data, error } = await supabase.from('user_schedules').insert(schedules).select();

        if (error) console.error("Error:", error);
        else console.log(`Created ${data.length} schedules.`);

    } catch (e) {
        console.error(e);
    }
}

setupTestSchedules();
