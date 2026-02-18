
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) process.exit(1);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function reproduceLogic() {
    console.log("Reproducing Camping Reminder Logic...");

    // Exact logic from index.ts
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 3600000);
    const today = kst.toISOString().split('T')[0];
    const tomorrowDate = new Date(kst); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toISOString().split('T')[0];
    const d4Date = new Date(kst); d4Date.setDate(d4Date.getDate() + 4);
    const d4 = d4Date.toISOString().split('T')[0];

    console.log(`Dates: Today=${today}, Tomorrow=${tomorrow}, D4=${d4}`);

    const { data: schedules, error } = await supabase
        .from('user_schedules')
        .select('*')
        .in('status', ['scheduled'])
        .in('check_in', [today, tomorrow, d4]);

    if (error) {
        console.error("Query Error:", error);
    } else {
        console.log(`Query Result Count: ${schedules?.length}`);
        schedules?.forEach(s => console.log(`- ${s.id} ${s.check_in} ${s.campground_name}`));
    }
}

reproduceLogic();
