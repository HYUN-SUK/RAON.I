const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY
);

async function checkRLS() {
    console.log('--- RLS Policy Inspection ---');

    // Check if RLS is enabled for user_schedules
    const { data: rlsStatus, error: rlsError } = await supabase
        .rpc('get_rls_status', { table_name: 'user_schedules' });

    // If RPC doesn't exist, try querying directly from information_schema via standard SQL if possible
    // But usually we check by trying an anonymous query

    const anonClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    console.log('\n[Test] Querying user_schedules with ANON_KEY...');
    const { data: anonSchedules, error: anonError } = await anonClient
        .from('user_schedules')
        .select('id')
        .limit(1);

    if (anonError) {
        console.log('ANON Query Error:', anonError.message);
    } else {
        console.log('ANON Query Result count:', anonSchedules ? anonSchedules.length : 0);
    }

    console.log('\n[Test] Querying notifications with ANON_KEY...');
    const { data: anonNotifs, error: anonNotifError } = await anonClient
        .from('notifications')
        .select('id')
        .limit(1);

    if (anonNotifError) {
        console.log('ANON Notifications Error:', anonNotifError.message);
    } else {
        console.log('ANON Notifications count:', anonNotifs ? anonNotifs.length : 0);
    }
}

checkRLS();
