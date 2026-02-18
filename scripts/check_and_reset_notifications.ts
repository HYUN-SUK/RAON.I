
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = SUPABASE_URL ? SUPABASE_URL.match(/https:\/\/([^.]+)\./)?.[1] : null;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PROJECT_REF) {
    console.error("Missing Config");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkAndReset() {
    console.log("Checking schedules for D-1 (Tomorrow) and D-4 (Today+4)...");

    const now = new Date();
    // KST approximation for script
    const kst = new Date(now.getTime() + 9 * 3600000);
    const today = kst.toISOString().split('T')[0];

    const tmr = new Date(kst); tmr.setDate(tmr.getDate() + 1);
    const tomorrow = tmr.toISOString().split('T')[0];

    const d4d = new Date(kst); d4d.setDate(d4d.getDate() + 4);
    const d4 = d4d.toISOString().split('T')[0];

    console.log(`Targets: Tomorrow=${tomorrow}, D4=${d4}`);

    const { data: schedules, error } = await supabase
        .from('user_schedules')
        .select('*')
        .in('check_in', [tomorrow, d4]);

    if (error) {
        console.error("Error fetching schedules:", error);
        return;
    }

    console.log(`Found ${schedules.length} schedules.`);

    const toReset = [];
    for (const s of schedules) {
        console.log(`- [${s.check_in}] ${s.campground_name} (User: ${s.user_id})`);
        console.log(`  Status: ${s.status}`);
        console.log(`  Flags: D1=${s.notification_d1_sent}, D4=${s.notification_d4_sent}`);

        // Force reset ALL flags for robust testing
        // This covers cases where Server Time might differ from Local Time (e.g., Server thinks it's already D-0)
        toReset.push({ id: s.id, col: 'notification_d1_sent' });
        toReset.push({ id: s.id, col: 'notification_d4_sent' });
        toReset.push({ id: s.id, col: 'notification_d0_sent' });
    }

    if (toReset.length > 0) {
        console.log(`Creating reset for ${toReset.length} flags...`);
        for (const item of toReset) {
            await supabase.from('user_schedules').update({ [item.col]: false }).eq('id', item.id);
            console.log(`  Reset ${item.col} for ${item.id}`);
        }
        console.log("Flags reset complete.");
    } else {
        console.log("No flags needed resetting (or no matching schedules).");
    }

    // Now Invoke Function
    console.log("\nInvoking camping-reminder function...");
    const funcUrl = `https://${PROJECT_REF}.supabase.co/functions/v1/camping-reminder`;
    try {
        const res = await fetch(funcUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        const text = await res.text();
        console.log(`Function Response: ${res.status}`);
        console.log(text);
    } catch (e) {
        console.error("Function invoke error:", e);
    }
}

checkAndReset();
