const { execSync } = require('child_process');
const fs = require('fs');
try {
    const output = execSync('git log -p -3 supabase/migrations/20260219213500_master_fix_v1.sql', { encoding: 'utf8' });
    fs.writeFileSync('diff.utf8.txt', output, 'utf8');
} catch (e) {
    console.error(e.message);
}
