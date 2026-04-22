import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectData() {
    console.log('--- Inspecting master_places raw_data for Prestige landmarks ---');
    
    const { data, error } = await supabase
        .from('master_places')
        .select('name, raw_data')
        .eq('is_protected', true)
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(JSON.stringify(data, null, 2));
}

inspectData().catch(console.error);
