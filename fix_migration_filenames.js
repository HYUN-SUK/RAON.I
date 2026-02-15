
const fs = require('fs');
const path = require('path');

const migrationsDir = 'supabase/migrations';
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

// Group by 8-digit prefix
const groups = {};
files.forEach(file => {
    const match = file.match(/^(\d{8})_(.*)$/);
    if (match) {
        const prefix = match[1];
        if (!groups[prefix]) groups[prefix] = [];
        groups[prefix].push(file);
    }
});

Object.keys(groups).forEach(prefix => {
    const groupFiles = groups[prefix].sort(); // Alphabetical sort to maintain order

    groupFiles.forEach((file, index) => {
        // Only rename if it's strictly 8 digits (avoid messing with already long timestamps if they exist starting with same date? 
        // actually my regex ^(\d{8})_ ensures we only pick 8 digit ones if followed immediately by _)
        // Wait, 20260214000001 matches ^(\d{8})_ ? No, it matches ^(\d{14})_ or (\d+).
        // ^(\d{8})_(.*) matches "20251220_foo.sql".
        // Does "20260214000001_foo.sql" match?
        // "20260214" captures, then "000001_foo.sql".
        // SO checking length of prefix vs file start is safer. or simple regex ^\d{8}_

        if (!/^\d{8}_/.test(file)) return;

        // Generate suffix: HHMMSS. We can just use index as seconds.
        // Support up to many files.
        // formatted index: 000000 + index
        const indexStr = String(index).padStart(6, '0');
        // Actually typical format is YYYYMMDDHHMMSS. 
        // Prefix (8) + Index (6) = 14 digits. Perfect.

        const newTimestamp = `${prefix}${indexStr}`;
        const restOfName = file.substring(9); // remove 20251220_
        const newName = `${newTimestamp}_${restOfName}`;

        if (file !== newName) {
            fs.renameSync(path.join(migrationsDir, file), path.join(migrationsDir, newName));
            console.log(`Renamed: ${file} -> ${newName}`);
        }
    });
});
