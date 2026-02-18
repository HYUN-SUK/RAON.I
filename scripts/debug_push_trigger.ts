
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

// Load .env.local manually since we are running a script
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = SUPABASE_URL ? SUPABASE_URL.split('://')[1].split('.')[0] : 'khqiqwtoyvesxahsjukk'; // Fallback to hardcoded ref from migration

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testEdgeFunction() {
    console.log("\nStarting Edge Function Direct Call Test...");

    // 1. Get a user
    const { data: users } = await supabase.from('profiles').select('id, nickname').limit(1);
    if (!users || users.length === 0) {
        console.error("No users found to test with.");
        return;
    }
    const testUser = users[0];

    // 2. Prepare Payload (mimic DB record)
    const payload = {
        record: {
            id: '00000000-0000-0000-0000-000000000000', // Dummy ID
            user_id: testUser.id,
            title: 'Direct Edge Function Test',
            body: 'This is a direct API call test.',
            data: { link: '/test' },
            created_at: new Date().toISOString()
        }
    };

    const functionUrl = `https://${PROJECT_REF}.supabase.co/functions/v1/push-notification`;
    console.log(`Calling ${functionUrl}...`);

    try {
        const res = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify(payload)
        });

        const text = await res.text();
        console.log(`Response Status: ${res.status}`);
        console.log(`Response Body: ${text}`);

        if (res.status === 200) {
            console.log("✅ Edge Function works! The issue is definitely the DB Trigger.");
        } else {
            console.log("❌ Edge Function failed. Check logs/secrets.");
        }

    } catch (e: any) {
        console.error("Fetch error:", e.message);
    }
}

(async () => {
    await testEdgeFunction();
})();
