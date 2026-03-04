const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY
);

async function simulate() {
    const now = new Date("2026-03-03T00:00:00Z"); // 09:00 AM KST
    const kst = new Date(now.getTime() + 9 * 3600000);
    const today = kst.toISOString().split('T')[0];

    const tomorrowDate = new Date(kst); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toISOString().split('T')[0];

    const d4Date = new Date(kst); d4Date.setDate(d4Date.getDate() + 4);
    const d4 = d4Date.toISOString().split('T')[0];

    console.log(`[Simulate] Today: ${today}, Tomorrow: ${tomorrow}, D-4: ${d4}`);

    const { data: schedules, error } = await supabase
        .from('user_schedules')
        .select('*')
        .in('check_in', [today, tomorrow, d4]);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log(`Found ${schedules.length} schedules.`);
        console.log(schedules.map(s => ({ id: s.id, check_in: s.check_in, d1_sent: s.notification_d1_sent })));
    }
}

simulate();
