const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debugInsert() {
    const testRow = {
        api_source: 'DEBUG',
        category: 'DEBUG',
        name: 'Debug Test',
        lat: 37.5,
        lng: 127.0,
        trust_score: 0,
        // created_at: new Date().toISOString() // Let's try omitting it first
    };

    const { data, error } = await supabase.from('smart_plan_facts').insert([testRow]).select();
    
    if (error) {
        console.error('INSERT_ERROR:', JSON.stringify(error, null, 2));
    } else {
        console.log('INSERT_SUCCESS:', JSON.stringify(data, null, 2));
    }
}

debugInsert();
