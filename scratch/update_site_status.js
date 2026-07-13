require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdate() {
    try {
        console.log("Testing UPDATE of 'is_active' to false for 'site-1'...");
        const { data, error } = await supabase
            .from('sites')
            .update({ is_active: false })
            .eq('id', 'site-1')
            .select();

        if (error) {
            console.error("DB Update Error:", error);
        } else {
            console.log("DB Update Success! Updated Row:", data);
        }
    } catch (e) {
        console.error("Exception:", e);
    }
}

testUpdate();
