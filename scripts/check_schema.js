
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('Checking point_history schema...');
    const { data, error } = await supabase
        .from('point_history')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error selecting from point_history:', error);
    } else {
        if (data.length > 0) {
            console.log('Keys in point_history row:', Object.keys(data[0]));
        } else {
            console.log('point_history is empty, cannot verify columns directly via select *');
            // Try to select specific new column
            const { error: err2 } = await supabase
                .from('point_history')
                .select('related_id')
                .limit(1);

            if (err2) {
                console.log('related_id column does NOT exist (or error):', err2.message);
            } else {
                console.log('related_id column EXISTS.');
            }
        }
    }
}

checkSchema();
