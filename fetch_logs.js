const { execSync } = require('child_process');
const fs = require('fs');

try {
    // Use a different approach: check specific timeline or just dump standard error safely
    console.log("Fetching logs...");
    // Use project reference directly, maybe the issue was missing auth or wrong flag
    // Check the version of Supabase CLI
    const version = execSync('npx supabase --version').toString();
    console.log("Supabase CLI:", version);

    // Try logging without project-ref if we are linked
    const output = execSync('npx supabase functions logs push-notification', { encoding: 'utf8' });
    fs.writeFileSync('func_logs.utf8.txt', output);
    console.log("Logs saved.");
} catch (e) {
    console.error("Exec failed:", e.message);
    if (e.stdout) fs.writeFileSync('func_logs_out.txt', e.stdout);
    if (e.stderr) fs.writeFileSync('func_logs_err.txt', e.stderr);
}
