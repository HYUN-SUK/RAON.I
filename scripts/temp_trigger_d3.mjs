import dotenv from 'dotenv';
import fetch from 'node-fetch';
dotenv.config({ path: '.env.local' });

async function runD3() {
    const targetDate = '2026-03-28';
    console.log(`Triggering D-3 Caching for ${targetDate}...`);
    try {
        const res = await fetch('http://localhost:3000/api/cron/sync-smart-plan', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${process.env.CRON_SECRET}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ targetDate })
        });
        const json = await res.json();
        console.log(`HTTP Status: ${res.status}`);
        console.log(`Response:`, JSON.stringify(json, null, 2));
    } catch (e) {
        console.error("Error triggering D-3:", e.message);
    }
}
runD3();
