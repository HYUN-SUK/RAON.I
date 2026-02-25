const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function runDiagnosis() {
    const result = {};
    const todayKST = new Date(new Date().getTime() + 9 * 3600000);
    const todayStr = todayKST.toISOString().split('T')[0];

    result.timestamp = new Date().toISOString();
    result.targetDateKST = todayStr;

    try {
        // 1. Check Caches to see if prefetch ran today
        const { data: weatherCache } = await supabase.from('weather_cache').select('nx, ny, updated_at').order('updated_at', { ascending: false }).limit(5);
        const { data: nearbyCache } = await supabase.from('nearby_cache').select('region_code, base_date, updated_at').order('updated_at', { ascending: false }).limit(5);

        result.cacheStatus = {
            weather: weatherCache,
            nearby: nearbyCache
        };

        // 2. Check Notifications to see if dispatch ran today
        const { data: recentNotifs } = await supabase.from('notifications')
            .select('*')
            .eq('category', 'reservation')
            .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
            .order('created_at', { ascending: false });

        result.recentNotifications = recentNotifs;

        // 3. Check User Schedules for tootg@naver.com active today or tomorrow
        const { data: profile } = await supabase.from('profiles').select('id').eq('email', 'tootg@naver.com').single();
        if (profile) {
            const { data: userSchedules } = await supabase.from('user_schedules')
                .select('*')
                .eq('user_id', profile.id)
                .gte('check_in', '2026-02-24') // Look back slightly
                .order('check_in', { ascending: true });

            result.schedules = userSchedules;
        }

        fs.writeFileSync('diag_result_day5.json', JSON.stringify(result, null, 2));
        console.log("Diagnosis complete. Results saved to diag_result_day5.json");

    } catch (err) {
        console.error("Diagnosis failed:", err);
    }
}

runDiagnosis();
