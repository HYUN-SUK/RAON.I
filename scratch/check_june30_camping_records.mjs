import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkJune30CampingRecords() {
    console.log('Inspecting camping_records table...');

    const { data: records, error } = await supabase
        .from('camping_records')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching camping_records:', error);
        return;
    }

    console.log(`Total camping_records count: ${records.length}`);
    records.forEach(r => {
        console.log(`- ID: ${r.id} | Type: ${r.campground_type} | Date: ${r.created_at} | Content: "${r.content}" | Name: ${r.campground_name}`);
    });

    const june30Records = records.filter(r => (r.created_at || '').includes('-06-30'));
    console.log(`\nJune 30 Records count: ${june30Records.length}`);
}

checkJune30CampingRecords();
