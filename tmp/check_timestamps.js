const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTimestamps() {
    const sources = ['LARGE', 'SUPER'];
    
    for (const s of sources) {
        const { data, error } = await supabase
            .from('master_places')
            .select('created_at, updated_at')
            .ilike('api_source', `%${s}%`)
            .limit(1);
        
        if (!error && data && data.length > 0) {
            console.log(`${s}: Created At = ${data[0].created_at}, Updated At = ${data[0].updated_at}`);
        } else {
            console.log(`${s}: No records found or error: ${error?.message}`);
        }
    }
}

checkTimestamps();
