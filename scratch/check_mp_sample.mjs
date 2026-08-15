import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkSample() {
    const { data, error } = await anonClient.from('master_places').select('id, name, category').limit(2);
    console.log('master_places sample read via Anon:', data, 'error:', error);
}

checkSample();
