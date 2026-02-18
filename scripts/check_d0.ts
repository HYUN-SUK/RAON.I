
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

async function checkD0() {
    const now = new Date();
    // KST
    const kst = new Date(now.getTime() + 9 * 3600000);
    const today = kst.toISOString().split('T')[0];

    console.log(`Checking D-0 status for [${today}]...`);

    const { data } = await supabase
        .from('user_schedules')
        .select('*')
        .eq('check_in', today);

    if (!data || data.length === 0) {
        console.log("No schedules found for today.");
        return;
    }

    data.forEach(s => {
        console.log(`ID: ${s.id}`);
        console.log(`CheckIn: '${s.check_in}'`);
        console.log(`Status:  '${s.status}'`);
        console.log(`Flag D0: ${s.notification_d0_sent} (Should be false to send)`);
    });
}

checkD0();
