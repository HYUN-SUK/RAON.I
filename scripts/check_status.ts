
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

async function checkStatus() {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 3600000);
    const tmr = new Date(kst); tmr.setDate(tmr.getDate() + 1);
    const tomorrow = tmr.toISOString().split('T')[0];
    const d4d = new Date(kst); d4d.setDate(d4d.getDate() + 4);
    const d4 = d4d.toISOString().split('T')[0];

    console.log(`Checking status for ${tomorrow} and ${d4}`);

    const { data, error } = await supabase
        .from('user_schedules')
        .select('id, status, check_in, campground_name')
        .in('check_in', [tomorrow, d4]);

    if (data) {
        data.forEach(s => console.log(`[${s.check_in}] ${s.campground_name} -> Status: '${s.status}'`));
    } else {
        console.error(error);
    }
}

checkStatus();
