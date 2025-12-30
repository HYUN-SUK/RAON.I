const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Note: To create functions, we ideally need SERVICE_ROLE_KEY. 
// If ANON key doesn't have permissions, this will fail.
// Checking if user has SERVICE_ROLE_KEY in .env.local usually... 
// Usually local dev .env has it? Or we hope ANON key is superuser in local?
// If this fails, we will fallback to asking user to run SQL.
// Let's assume we might need the service role key if available, but for now try anon.
// Wait, we can't read service role key if it's not in env.
// Let's try with the provided key. If it fails, I'll instruct the user.

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
-- 1. Create robust withdraw function (Bypasses RLS)
CREATE OR REPLACE FUNCTION withdraw_mission(p_mission_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    DELETE FROM public.user_missions
    WHERE mission_id = p_mission_id AND user_id = v_user_id;
    
    RETURN FOUND;
END;
$$;
`;

async function applyFix() {
    console.log('Applying withdraw_mission RPC...');

    // We use a hacky way to run SQL if we don't have direct SQL access?
    // Supabase JS client doesn't expose .sql() or .query() usually.
    // DOES THE USER have a 'postgres' connection string?
    // Usually 'npm run dev' implies local development.
    // Maybe we can use 'pg' library if installed?
    // But we don't know if 'pg' is installed. 

    // ALTERNATIVE: Use the RPC 'exec_sql' if it exists (some setups have it).
    // Or just try to create it via a special setup endpoint?

    // Actually, I see 'supabase/migrations' folder.
    // The Standard PRO way is to ask the user to run `supabase db push` or `npx supabase db push`.
    // But I want to be agentic.

    // Let's rely on the user having run the migrations... 
    // BUT the user said "Run npm run dev".
    // AND I see `debug_db.js` was used successfully to QUERY.
    // `debug_db.js` used the supabase client.

    // If I cannot run SQL via client, I must update the Application Code to use the RPC *assuming* it exists
    // (maybe it was in the migration files I saw?).
    // `20251230_fix_mission_final.sql` DEFINES this function.
    // If the user's environment automatically syncs migrations (e.g. `supabase start`), it might be there.

    // Let's CHECK if the function exists first using `debug_db.js` strategy (rpc call).
    const { error } = await supabase.rpc('withdraw_mission', { p_mission_id: '00000000-0000-0000-0000-000000000000' });

    if (error && error.message.includes('Could not find the function')) {
        console.error('Function withdraw_mission does NOT exist.');
        console.error('Please run the SQL in supabase/migrations/20251230_fix_mission_final.sql manually or via supabase cli.');
    } else {
        console.log('Function withdraw_mission seems to exist (or failed with other error, meaning it exists).');
        console.log('Error was:', error?.message);
    }
}

applyFix();
