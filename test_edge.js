const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function testEdge() {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/camping-reminder?mode=prefetch`;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    console.log(`Testing Edge at: ${url}`);

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${anonKey}`,
                'Content-Type': 'application/json'
            }
        });

        const text = await res.text();
        console.log(`Status: ${res.status}`);
        console.log(`Response: ${text}`);
    } catch (err) {
        console.error("Test Failed:", err.message);
    }
}

testEdge();
