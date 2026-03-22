import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
async function runD3() {
    console.log("Triggering D-3 Caching...");
    const res = await fetch('http://localhost:3000/api/cron/sync-smart-plan', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` }
    });
    const text = await res.text();
    console.log(`HTTP Status: ${res.status}`);
    console.log(`Response: ${text}`);
}
runD3();
