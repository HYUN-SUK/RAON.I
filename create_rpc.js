const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function createRpc() {
    const sql = `
    CREATE OR REPLACE FUNCTION delete_push_token(token_to_delete TEXT)
    RETURNS VOID AS $$
    BEGIN
        DELETE FROM push_tokens WHERE token = token_to_delete;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    // Use rpc to execute arbitrary SQL is not supported directly, 
    // but we can use the 'sql' endpoint if we have the right key or just run it via the dashboard.
    // However, I can try to run it via supabase-js using a trick or just use the CLI correctly.

    console.log('Please run the following SQL in your Supabase Dashboard SQL Editor:');
    console.log(sql);
}

createRpc();
