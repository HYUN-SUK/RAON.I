const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function runReminder(mode) {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/camping-reminder?mode=${mode}`;
    const token = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY;

    console.log(`Calling ${url} with mode ${mode}`);
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    const status = res.status;
    const body = await res.text();
    console.log(`Status: ${status}`);
    console.log(`Body: ${body}`);
}

runReminder('dispatch');
