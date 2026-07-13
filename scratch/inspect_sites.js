require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    try {
        console.log("Fetching ALL rows from 'sites' table to inspect contents...");
        const { data, error } = await supabase.from('sites').select('id, name, type, is_active, price');
        if (error) {
            console.error("Error fetching sites:", error);
            return;
        }
        console.log("Total rows found:", data.length);
        console.log("All sites in DB:", data);
    } catch (e) {
        console.error("Exception:", e);
    }
}

check();
