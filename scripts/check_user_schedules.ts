
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.RAON_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing credentials");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const USER_ID = "4730be31-30b5-4594-a993-d8f5a7a5e26c"; // tootg@naver.com

async function checkUserSchedules() {
    console.log(`Checking schedules for user: ${USER_ID}`);

    // Get today's date in KST for reference
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const today = new Date(now.getTime() + kstOffset).toISOString().split('T')[0];

    console.log(`Today (KST): ${today}`);

    const { data: schedules, error } = await supabase
        .from('user_schedules')
        .select('*')
        .eq('user_id', USER_ID);

    if (error) {
        console.error('Error fetching schedules:', error);
        return;
    }

    if (!schedules || schedules.length === 0) {
        console.log("No schedules found for this user.");
        return;
    }

    const output = schedules.map(s => {
        const checkInDate = new Date(s.check_in);
        const todayDate = new Date(today);
        // Reset times for accurate day diff
        checkInDate.setHours(0, 0, 0, 0);
        todayDate.setHours(0, 0, 0, 0);

        const diffTime = checkInDate.getTime() - todayDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return {
            id: s.id,
            camp: s.camp_name,
            check_in: s.check_in,
            d_day: diffDays,
            status: s.status,
            d0: s.notification_d0_sent,
            d1: s.notification_d1_sent,
            d4: s.notification_d4_sent
        };
    });

    fs.writeFileSync('schedules.json', JSON.stringify(output, null, 2));
    console.log("Written to schedules.json");
}

checkUserSchedules();
