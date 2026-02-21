require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function runTest() {
    console.log("=== Testing PREFETCH ===");
    try {
        const res1 = await fetch(`${url}/functions/v1/camping-reminder?mode=prefetch`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            }
        });
        const text1 = await res1.text();
        console.log("Prefetch Status:", res1.status);
        console.log("Prefetch Body:", text1);

        console.log("\n=== Testing DISPATCH ===");
        const res2 = await fetch(`${url}/functions/v1/camping-reminder?mode=dispatch`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            }
        });
        const text2 = await res2.text();
        console.log("Dispatch Status:", res2.status);
        console.log("Dispatch Body:", text2);

    } catch (err) {
        console.error(err);
    }
}

runTest();
