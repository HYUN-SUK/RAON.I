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

async function checkReviewsTable() {
    console.log('Checking "reviews" table...');
    const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error accessing reviews table:', error);
    } else {
        console.log('Successfully accessed reviews table.');
        console.log('Row count:', data.length);
    }

    console.log('Checking "orders" table...');
    const { data: data2, error: error2 } = await supabase
        .from('orders')
        .select('*')
        .limit(1);

    if (error2) {
        console.error('Error accessing orders table:', error2);
    } else {
        console.log('Successfully accessed orders table.');
        console.log('Row count:', data2.length);
    }
}

checkReviewsTable();
