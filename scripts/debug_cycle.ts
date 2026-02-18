
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

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

async function runDebugCycle() {
    console.log("Starting Debug Cycle...");

    // 1. Calculate Target Dates (KST)
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 3600000);
    const today = kst.toISOString().split('T')[0];
    const tomorrowDate = new Date(kst); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toISOString().split('T')[0];

    console.log(`Targeting Check-in Date: ${tomorrow} (D-1)`);

    // 2. Find Schedule
    const { data: schedules, error } = await supabase
        .from('user_schedules')
        .select('*')
        .eq('check_in', tomorrow);

    if (error || !schedules || schedules.length === 0) {
        console.error("No schedule found for tomorrow!");
        return;
    }

    const schedule = schedules[0];
    console.log(`Found Schedule: ${schedule.id} (${schedule.campground_name})`);
    console.log(`User ID: ${schedule.user_id}`);

    const { count: tokenCount } = await supabase
        .from('push_tokens')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', schedule.user_id);

    console.log(`Push Tokens for User: ${tokenCount}`);

    console.log(`Current Flags: D0=${schedule.notification_d0_sent}, D1=${schedule.notification_d1_sent}, D4=${schedule.notification_d4_sent}`);

    // 3. Reset Flags
    console.log("Resetting flags to FALSE...");
    const { error: updateError } = await supabase
        .from('user_schedules')
        .update({
            notification_d0_sent: false,
            notification_d1_sent: false,
            notification_d4_sent: false
        })
        .eq('id', schedule.id);

    if (updateError) {
        console.error("Failed to reset flags:", updateError);
        return;
    }
    console.log("Flags reset.");

    // 4. Invoke Edge Function
    // Extract Project Ref for URL
    const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\./)?.[1];
    const functionUrl = `https://${projectRef}.supabase.co/functions/v1/camping-reminder`;

    console.log(`Invoking Edge Function: ${functionUrl}`);

    const res = await fetch(functionUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({}) // Body doesn't matter much but good to send valid JSON
    });

    const text = await res.text();
    console.log(`Response Status: ${res.status}`);
    try {
        const json = JSON.parse(text);
        fs.writeFileSync('debug_result.json', JSON.stringify(json, null, 2));
        console.log("Written to debug_result.json");
        console.log(`COUNT: ${json.count}`);
        console.log(`Today: ${json.debug?.today}`);
        console.log(`Tomorrow: ${json.debug?.tomorrow}`);
        console.log(`D4: ${json.debug?.d4}`);
        if (json.debug?.schedules_found) {
            json.debug.schedules_found.forEach((s: any) => {
                console.log(`SCHED: ${s.id} | ${s.check_in} | ${s.status} | D0:${s.d0} D1:${s.d1}`);
            });
        }
    } catch (e) {
        console.log(`Response Body (Not JSON):`, text);
        fs.writeFileSync('debug_result.txt', text);
    }
}

runDebugCycle();
