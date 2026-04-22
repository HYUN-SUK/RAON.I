import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSudeoksa() {
    const { data, error } = await supabase
        .from('master_places')
        .select('name, sigungu, address')
        .ilike('name', '%수덕사%');
    
    console.log('Results for 수덕사:', JSON.stringify(data, null, 2));
}

checkSudeoksa().catch(console.error);
