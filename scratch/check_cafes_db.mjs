import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    console.log('\n--- Checking for "날마다봄날" ---');
    const { data: bData, error } = await supabase
        .from('master_places')
        .select('id, name, category, address')
        .ilike('name', '%날마다봄날%');
    
    if (error) console.error('Error:', error);
    else console.log('날마다봄날 search result:', bData);

    console.log('\n--- Checking for "백운호수 카페" ---');
    const { data: cData } = await supabase
        .from('master_places')
        .select('id, name, category, address')
        .ilike('name', '%백운호수%')
        .limit(10);
    console.log('백운호수 search result:', cData);
}

check();
