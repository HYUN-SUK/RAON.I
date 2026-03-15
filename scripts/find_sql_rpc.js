const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectTable() {
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
    // We try many potential RPC names
    const rpcs = ['exec_sql', 'run_sql', 'sql_query', 'query', 'execute'];
    
    for (const rpc of rpcs) {
        process.stdout.write(`Trying RPC: ${rpc}... `);
        const { data, error } = await supabase.rpc(rpc, { sql_query: query, query: query, sql: query });
        if (error) {
            console.log(`Failed: ${error.message}`);
        } else {
            console.log('SUCCESS!');
            console.log(JSON.stringify(data, null, 2));
            return;
        }
    }
}

inspectTable();
