require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectTable() {
    const { data, error } = await supabase
        .from('user_schedules')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching table row:', error);
    } else {
        console.log('Columns in user_schedules:');
        console.log(Object.keys(data[0] || {}));
        console.log('Sample row:', data[0]);
    }
}

inspectTable();
