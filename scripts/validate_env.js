const fs = require('fs');
const path = require('path');
const envPath = path.resolve(__dirname, '../.env.local');
const destPath = path.resolve(__dirname, '../validation_result.txt');

const logBuffer = [];
function log(msg) {
    console.log(msg);
    logBuffer.push(msg);
}
function error(msg) {
    console.error(msg);
    logBuffer.push(msg);
}

log('Checking .env.local at: ' + envPath);

try {
    if (!fs.existsSync(envPath)) {
        error('❌ .env.local FILE NOT FOUND');
        fs.writeFileSync(destPath, logBuffer.join('\n'));
        process.exit(1);
    }

    const content = fs.readFileSync(envPath, 'utf8');
    const vars = {};
    content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) vars[match[1].trim()] = match[2].trim();
    });

    const required = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY'
    ];

    let missing = false;
    required.forEach(key => {
        if (!vars[key]) {
            error(`❌ MISSING: ${key}`);
            missing = true;
        } else {
            const val = vars[key];
            const preview = val.length > 5 ? val.substring(0, 3) + '...' + val.substring(val.length - 3) : '***';
            log(`✅ FOUND: ${key} (${preview})`);
        }
    });

    if (missing) {
        error('⚠️ Environment variables are incomplete.');
        fs.writeFileSync(destPath, logBuffer.join('\n'));
        process.exit(1);
    } else {
        log('🎉 All required environment variables are present.');
        fs.writeFileSync(destPath, logBuffer.join('\n'));
    }

} catch (err) {
    error('❌ Error reading file: ' + err.message);
    fs.writeFileSync(destPath, logBuffer.join('\n'));
}
