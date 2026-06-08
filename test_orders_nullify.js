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

    console.log("Nullifying user_id in orders for user...");
    const { data, error } = await supabase
        .from('orders')
        .update({ user_id: null })
        .eq('user_id', userId);

    if (error) {
        console.error("Nullify failed:", error.message);
    } else {
        console.log("Nullify succeeded! Updated orders count:", data ? data.length : 'OK');
        
        // Attempt to delete user now
        console.log("Attempting deleteUser now...");
        const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
        if (deleteError) {
            console.error("Delete failed STILL:", deleteError.message);
        } else {
            console.log("Delete SUCCEEDED! The culprit was orders.user_id foreign key constraint!");
        }
    }
}

run();
