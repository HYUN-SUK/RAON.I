const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function testProxy() {
    const url = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const secret = process.env.CRON_SECRET;

    console.log(`Testing Proxy at: ${url}/api/cron/camping-reminder?mode=prefetch`);
    console.log(`Using Secret: ${secret ? secret.substring(0, 5) + '...' : 'NONE'}`);

    try {
        const res = await fetch(`${url}/api/cron/camping-reminder?mode=prefetch`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${secret}`,
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

testProxy();
