
const fs = require('fs');
const { execSync } = require('child_process');

const content = fs.readFileSync('migration_list.txt', 'utf8');
const lines = content.split('\n');

const versionsToRevert = [];

// Parse output of migration list
// Format: 
//   Local          | Remote   | Time (UTC)          
//                  | 20251220 | 20251220            
//   20251220000000 |          | 2025-12-20 00:00:00 

lines.forEach(line => {
    // We look for lines where Local is empty (or we just look for 8-digit remote)
    // The columns are fixed width-ish or pipe separated.
    const parts = line.split('|').map(s => s.trim());

    if (parts.length >= 2) {
        const remote = parts[1];
        // Check if remote is exactly 8 digits
        if (/^\d{8}$/.test(remote)) {
            versionsToRevert.push(remote);
        }
    }
});

console.log(`Found ${versionsToRevert.length} versions to revert.`);

if (versionsToRevert.length > 0) {
    console.log("Reverting...");
    // We can chain them or run one by one. Chaining might be faster but command length limit?
    // Let's run one by one to count progress.

    versionsToRevert.forEach((version, idx) => {
        try {
            console.log(`[${idx + 1}/${versionsToRevert.length}] Reverting ${version}...`);
            execSync(`npx supabase migration repair --status reverted ${version}`, { stdio: 'inherit' });
        } catch (e) {
            console.error(`Failed to revert ${version}:`, e.message);
        }
    });
    console.log("All done.");
} else {
    console.log("No old versions found.");
}
