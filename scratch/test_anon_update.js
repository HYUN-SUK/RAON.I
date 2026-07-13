require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// NEXT_PUBLIC_SUPABASE_ANON_KEY를 사용해 클라이언트와 동일한 권한으로 찌름
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testAnonUpdate() {
    try {
        console.log("Testing ANON KEY update of 'is_active' to true for 'site-1'...");
        const { data, error } = await supabase
            .from('sites')
            .update({ is_active: true })
            .eq('id', 'site-1')
            .select();

        if (error) {
            console.error("Anon DB Update Error:", error);
        } else {
            console.log("Anon DB Update result (Updated Rows):", data);
            if (data && data.length === 0) {
                console.log("⚠️ WARNING: 0 rows updated! This indicates RLS (Row Level Security) is blocking anon update!");
            }
        }
    } catch (e) {
        console.error("Exception:", e);
    }
}

testAnonUpdate();
