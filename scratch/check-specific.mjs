import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSpecific() {
    const { data, error } = await supabase
        .from('master_places')
        .select('name, sigungu, address')
        .ilike('name', '%경복궁%');
    
    console.log(JSON.stringify(data, null, 2));
}

checkSpecific().catch(console.error);
