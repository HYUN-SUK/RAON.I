
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

const SCHEDULE_ID = "94097cce-e6dd-4e9f-b209-da44647b986d"; // The ID from debug_result.json

async function checkScheduleOwner() {
    console.log(`Checking owner for schedule: ${SCHEDULE_ID}`);

    const { data: schedule, error } = await supabase
        .from('user_schedules')
        .select('*')
        .eq('id', SCHEDULE_ID)
        .single();

    if (error) {
        console.error('Error fetching schedule:', error);
        return;
    }

    if (!schedule) {
        console.log("Schedule not found!");
        return;
    }

    console.log("Schedule Details:");
    console.log(`- ID: ${schedule.id}`);
    console.log(`- User ID: ${schedule.user_id}`);
    console.log(`- Check-in: ${schedule.check_in}`);
    console.log(`- Camp Name: ${schedule.camp_name || 'N/A'}`); // Handle potential missing column gracefully in log
}

checkScheduleOwner();
