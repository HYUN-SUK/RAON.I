const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkConstraints() {
    const query = `
        SELECT
            conname as name,
            pg_get_constraintdef(c.oid) as definition
        FROM
            pg_constraint c
        JOIN
            pg_namespace n ON n.oid = c.connamespace
        WHERE
            n.nspname = 'public'
            AND conrelid = 'master_places'::regclass;
    `;
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: query });
    if (error) {
        console.error('RPC Error:', error.message);
        return;
    }
    console.log('CONSTRAINTS:', JSON.stringify(data, null, 2));
}

checkConstraints();
