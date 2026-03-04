const fetch = require('node-fetch');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Config");
    process.exit(1);
}

const PROJECT_REF = SUPABASE_URL.match(/https:\/\/([^.]+)\./)?.[1];

async function debug() {
    console.log(`Invoking camping-reminder at project ${PROJECT_REF}...`);
    const funcUrl = `https://${PROJECT_REF}.supabase.co/functions/v1/camping-reminder`;

    try {
        const res = await fetch(funcUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`Status: ${res.status}`);
        const text = await res.text();
        console.log("Response:", text);
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

debug();
