
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Mock Dependencies
const getForecast = async (lat, lng, dateStr) => {
    return { temp_min: 15, temp_max: 25, sky: 'Sunny', pop: 0 };
};

const recommendMeals = async (supabase, context) => {
    return [{ id: 1, title: 'Test Meal A' }, { id: 2, title: 'Test Meal B' }];
};

// Main Logic
async function runLocalLogic() {
    console.log("Starting Local Logic Test...");

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
        // 1. Calculate KST Dates
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

        console.log(`Dates: Today=${today}, Tomorrow=${tomorrow}, D4=${d4}`);

        // 2. Query Schedules
        const { data: schedules, error } = await supabase
            .from('user_schedules')
            .select('id, user_id, campground_name, check_in, check_out, campground_lat, campground_lng, notification_d0_sent, notification_d1_sent, notification_d4_sent, member_count')
            .in('status', ['scheduled'])
            .in('check_in', [today, tomorrow, d4]);

        if (error) throw error;

        console.log(`Found ${schedules.length} schedules.`);

        const notifications = [];

        for (const schedule of schedules) {
            console.log(`Processing ${schedule.campground_name} (${schedule.check_in})...`);

            // D-Day
            if (schedule.check_in === today && !schedule.notification_d0_sent) {
                console.log("  -> Matches D-Day");
                notifications.push({ type: 'D-Day', title: '오늘이 캠핑 떠나는 날!' });
            }
            // D-1
            else if (schedule.check_in === tomorrow && !schedule.notification_d1_sent) {
                console.log("  -> Matches D-1");
                notifications.push({ type: 'D-1', title: '내일 캠핑 식사 추천' });
            }
            // D-4
            else if (schedule.check_in === d4 && !schedule.notification_d4_sent) {
                console.log("  -> Matches D-4");
                notifications.push({ type: 'D-4', title: '캠핑 4일 전' });
            } else {
                console.log("  -> No Match (Already sent or date mismatch?)");
                console.log(`     D0Sent: ${schedule.notification_d0_sent}, D1Sent: ${schedule.notification_d1_sent}, D4Sent: ${schedule.notification_d4_sent}`);
            }
        }

        const fs = require('fs');
        let logOutput = "Generated Notifications:\n";
        notifications.forEach(n => {
            logOutput += `- Type: ${n.type}, Title: ${n.title}\n`;
        });
        fs.writeFileSync('local_test_log.txt', logOutput, 'utf8');
        console.log("Log saved to local_test_log.txt");

    } catch (e) {
        console.error(e);
    }
}

runLocalLogic();
