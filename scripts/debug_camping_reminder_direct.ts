
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

async function debugCampingReminder() {
    console.log("Invoking camping-reminder directly to check logic...");

    // We want to see the 'debug' field in response
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
        console.log(`Status: ${res.status}`);
        try {
            const json = JSON.parse(text);
            console.log("\nResponse JSON:");
            console.log(JSON.stringify(json, null, 2));
        } catch {
            console.log("Response Text:", text);
        }

    } catch (e) {
        console.error("Function invoke error:", e);
    }
}

debugCampingReminder();
