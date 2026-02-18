
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

async function checkTokens() {
    console.log("Checking push tokens...");

    // 1. Get recent schedules to identify the user
    // We assume the user is the one with schedules tomorrow or D-4
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 3600000);
    const tmr = new Date(kst); tmr.setDate(tmr.getDate() + 1);
    const tomorrow = tmr.toISOString().split('T')[0];
    const d4d = new Date(kst); d4d.setDate(d4d.getDate() + 4);
    const d4 = d4d.toISOString().split('T')[0];

    const { data: schedules, error: schedError } = await supabase
        .from('user_schedules')
        .select('user_id, check_in')
        .in('check_in', [tomorrow, d4]);

    if (!schedules || schedules.length === 0) {
        console.log("No schedules found for tomorrow or D-4.");
        return;
    }

    const uniqueUsers = [...new Set(schedules.map(s => s.user_id))];
    console.log(`Found ${uniqueUsers.length} users with schedules.`);

    for (const userId of uniqueUsers) {
        const { data: tokens, error } = await supabase
            .from('push_tokens')
            .select('*')
            .eq('user_id', userId);

        console.log(`User ${userId}:`);
        if (error) {
            console.error("  Error fetching tokens:", error);
        } else if (tokens.length === 0) {
            console.error("  ❌ NO TOKENS FOUND! The user needs to visit the app to register a token.");
        } else {
            console.log(`  ✅ Found ${tokens.length} tokens.`);
            tokens.forEach(t => console.log(`    - [${t.device_type}] ${t.token} (Active: ${t.is_active})`));
        }
    }
}

checkTokens();
