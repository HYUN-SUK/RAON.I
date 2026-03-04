const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY
);

async function inspectDb() {
    console.log('--- Inspecting DB Structures ---');

    // 1. Check user_schedules columns
    const { data: schedules } = await supabase.from('user_schedules').select('*').limit(1);
    if (schedules && schedules.length > 0) {
        console.log('\n[user_schedules] Available columns:');
        console.log(Object.keys(schedules[0]).join(', '));
        console.log('Sample data:', JSON.stringify(schedules[0], null, 2));
    }

    // 2. Check recommendation_pool categories
    const { data: pool } = await supabase.from('recommendation_pool').select('category');
    if (pool) {
        const categories = [...new Set(pool.map(p => p.category))];
        console.log('\n[recommendation_pool] Available categories:');
        console.log(categories.join(', '));
    }
}

inspectDb();
