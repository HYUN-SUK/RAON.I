const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing ENV keys");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const userId = '4730be31-30b5-4594-a993-d8f5a7a5e26c'; // tootg@naver.com ID
    console.log(`Attempting to delete auth user ${userId} using Admin API...`);

    const { data, error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
        console.error("Delete failed!");
        console.error("Error Name:", error.name);
        console.error("Error Message:", error.message);
        console.error("Error Status:", error.status);
        console.error("Error Code:", error.code);
        console.error("Full Error Object:", JSON.stringify(error, null, 2));
    } else {
        console.log("Delete succeeded! User deleted.", data);
    }
}

run();
