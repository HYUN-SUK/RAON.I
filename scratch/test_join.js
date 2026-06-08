require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testJoin() {
    // getMyRecords 내부와 동일한 쿼리 실행
    const { data, error } = await supabase
        .from('camping_records')
        .select(`
            *,
            user_schedules (
                start_date,
                end_date
            )
        `)
        .eq('user_id', '4730be31-30b5-4594-a993-d8f5a7a5e26c')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Query Error:', error);
    } else {
        console.log('Query success! Loaded records:', data.length);
        console.log('First record item:', JSON.stringify(data[0], null, 2));
    }
}

testJoin();
