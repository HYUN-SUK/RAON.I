
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    fs.writeFileSync('debug_output.txt', 'Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifySchema() {
    let output = '';
    const log = (msg) => { output += msg + '\n'; };

    log('--- Verifying point_history columns via information_schema ---');
    // Check columns in point_history
    const { data: columns, error: colError } = await supabase
        .rpc('get_schema_info');

    // Direct select from information_schema might be blocked or complex via JS client without RPC sometimes
    // But we can try just selecting point_history again and hope for the best? 
    // Actually, supabase-js client doesn't expose a direct way to query information_schema easily unless we have rights 
    // or use a custom RPC. 
    // Let's try to infer from a simple insert test if we dare, OR
    // better: create a simple RPC in the migration file to check this? No, that's too much work.

    // Alternative: Try to select 'related_id' specifically.
    const { data: h1, error: e1 } = await supabase.from('point_history').select('related_id').limit(1);
    if (e1) {
        log('Attempt to select related_id failed: ' + e1.message);
    } else {
        log('Select related_id success (column exists).');
    }

    const { data: h2, error: e2 } = await supabase.from('point_history').select('related_mission_id').limit(1);
    if (e2) {
        log('Attempt to select related_mission_id failed: ' + e2.message);
    } else {
        log('Select related_mission_id success (column exists).');
    }

    log('\n--- Verifying RLS Policies on user_missions ---');
    // We cannot easily see pg_policies via client unless we are superuser or have access. 
    // But we can test the DELETE action.
    // To test DELETE, we need to be authenticated as a user who owns a row.
    // This script runs as admin/service_role if we use the service key, but here we use ANON key.
    // Anon key cannot delete usually unless RLS allows it for anon (unlikely).
    // We need to sign in a user.

    // We can't easily sign in as a real user without password. 
    // We will skip dynamic RLS verification script for now and rely on manual test or applying migration again.

    log('Skipping active RLS test in script. Please verify manually in Supabase Dashboard or by re-applying migration.');

    fs.writeFileSync('debug_output.txt', output);
}

verifySchema();

