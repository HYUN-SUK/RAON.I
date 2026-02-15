
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://khqiqwtoyvesxahsjukk.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocWlxd3RveXZlc3hhaHNqdWtrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTgzOTYwNSwiZXhwIjoyMDgxNDE1NjA1fQ.EKpyz8NvGZLbmTPn4m_-PZNeDD4GgcpzlqPDdY1inHI";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log("[Debug] Starting logic...");

    // 1. Calculate KST Dates (Exact logic from bundled.ts)
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

    console.log(`[Debug] Dates - Today: ${today}, Tomorrow: ${tomorrow}, D4: ${d4}`);

    // 2. Query Schedules
    const { data: schedules, error } = await supabase
        .from('user_schedules')
        .select('*')
        .in('status', ['scheduled'])
        .in('check_in', [today, tomorrow, d4]);

    if (error) {
        console.error("[Debug] Query Error:", error);
    } else {
        console.log(`[Debug] Found ${schedules.length} schedules.`);
        if (schedules.length > 0) {
            console.log(schedules);
        } else {
            // If empty, let's query ALL scheduled items to see their check_in dates
            const { data: allSchedules } = await supabase
                .from('user_schedules')
                .select('id, check_in, status')
                .eq('status', 'scheduled')
                .limit(5);
            console.log("[Debug] First 5 scheduled items in DB:", allSchedules);
        }
    }
}

run();
