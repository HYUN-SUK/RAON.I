require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    try {
        console.log("Fetching one row from 'sites' table to inspect columns...");
        const { data, error } = await supabase.from('sites').select('*').limit(1);
        if (error) {
            console.error("Error fetching sites:", error);
            return;
        }
        if (data && data.length > 0) {
            console.log("Columns present in remote 'sites' table:");
            console.log(Object.keys(data[0]));
            console.log("Sample row:", data[0]);
        } else {
            console.log("No rows found in 'sites' table.");
        }
    } catch (e) {
        console.error("Exception:", e);
    }
}

check();
