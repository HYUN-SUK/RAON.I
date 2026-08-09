import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase URL or Service Role Key missing in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const targetIds = [
    '0181af5a-14cb-4a5c-85a3-cf42771d7575',
    '49918fe4-638a-4c6d-bb7a-af96b52cd683',
    '0b35d573-6d26-4b3d-8b62-7e7f1bfc9e40',
    '31b54f0d-1e47-40a2-bbae-af017ee54217',
    'dbdbf25c-a9cb-4864-8a43-5bd59f23425c',
    'ef042a25-540d-4e50-a718-64ba322a66b0',
    '35687b02-5f90-4566-9a7b-a1f4e289518d'
];

async function deleteJune30Records() {
    console.log(`Starting deletion of ${targetIds.length} June 30 records from camping_records...`);

    const { data, error } = await supabase
        .from('camping_records')
        .delete()
        .in('id', targetIds)
        .select('id, campground_name');

    if (error) {
        console.error('Error deleting records:', error);
        process.exit(1);
    }

    console.log(`Successfully deleted ${data.length} records!`);
    data.forEach(r => console.log(`- Deleted: [${r.id}] ${r.campground_name}`));
}

deleteJune30Records();
