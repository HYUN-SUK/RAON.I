require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecords() {
    const { data, error } = await supabase
        .from('camping_records')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching records:', error);
    } else {
        console.log('Latest 5 records in DB:');
        console.log(JSON.stringify(data, null, 2));
    }
}

checkRecords();
