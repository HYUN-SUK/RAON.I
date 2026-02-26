const { execSync } = require('child_process');
const fs = require('fs');
try {
    const output = execSync('git log -p -n 3 supabase/functions/push-notification/index.ts', { encoding: 'utf8' });
    fs.writeFileSync('push_diff.utf8.txt', output, 'utf8');
} catch (e) {
    console.error(e.message);
}
