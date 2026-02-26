const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCols() {
    const { data: cols, error } = await supabase.rpc('get_table_columns', { table_name: 'notifications' });
    if (error) {
        // Fallback: try to select and see what comes back
        const { data, error: sErr } = await supabase.from('notifications').select('*').limit(1);
        if (sErr) {
            console.error("Select error:", sErr);
        } else {
            console.log("Notification Record Keys:", Object.keys(data[0] || {}));
        }
    } else {
        console.log("Columns:", cols);
    }
}
checkCols();
