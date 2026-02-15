
const fs = require('fs');
const path = require('path');

const migrationsDir = 'supabase/migrations';
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

let unsafeFiles = [];

files.forEach(file => {
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    let reasons = [];

    // Check CREATE TABLE without IF NOT EXISTS
    const createTableRegex = /CREATE TABLE\s+(?!IF NOT EXISTS)([\w\.]+)/gi;
    let match;
    while ((match = createTableRegex.exec(content)) !== null) {
        // Exclude specific patterns if needed, but stricter is better
        reasons.push(`CREATE TABLE without IF NOT EXISTS: ${match[1]}`);
    }

    // Check CREATE POLICY without DROP POLICY
    // This is a heuristic. We look for CREATE POLICY "Name" 
    // And see if DROP POLICY IF EXISTS "Name" appears in the file.
    const createPolicyRegex = /CREATE POLICY\s+"([^"]+)"/gi;
    while ((match = createPolicyRegex.exec(content)) !== null) {
        const policyName = match[1];
        if (!content.includes(`DROP POLICY IF EXISTS "${policyName}"`)) {
            reasons.push(`CREATE POLICY without DROP: "${policyName}"`);
        }
    }

    // Check CREATE TYPE (Enum) - simplistic check
    // If it has CREATE TYPE and no DO...EXCEPTION or surrounding check
    // Actually, checking for "DO" block presence near CREATE TYPE is hard with regex.
    // Let's just flag CREATE TYPE if it's not inside a DO block (rough check: file has DO?)
    // This might be false positive, so maybe just stick to Policies for now as they are the main pain point.

    if (reasons.length > 0) {
        unsafeFiles.push({ file, reasons });
    }
});

fs.writeFileSync('unsafe_migrations.json', JSON.stringify(unsafeFiles, null, 2), 'utf8');
console.log(`Scanned ${files.length} files. Found ${unsafeFiles.length} unsafe files.`);
