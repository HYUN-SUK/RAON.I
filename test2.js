const fs = require('fs');
const rawEnv = fs.readFileSync('.env.local', 'utf8');
const env = {};
rawEnv.split('\n').forEach(l => {
    const p = l.split('=');
    if (p.length >= 2) env[p[0].trim()] = p.slice(1).join('=').trim();
});
fetch('https://khqiqwtoyvesxahsjukk.supabase.co/functions/v1/camping-reminder?mode=dispatch', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json'
    }
})
    .then(async r => fs.writeFileSync('err_out.txt', 'Status: ' + r.status + '\nBody: ' + await r.text()))
    .catch(e => fs.writeFileSync('err_out.txt', 'Error: ' + e.message));
