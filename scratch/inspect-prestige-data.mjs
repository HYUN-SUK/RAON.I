import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectPrestige() {
    console.log('--- Searching for Prestige entries for 예산군 ---');
    
    const { data, error } = await supabase
        .from('master_places')
        .select('*')
        .eq('sigungu', '예산군')
        .eq('is_protected', true);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(JSON.stringify(data, null, 2));
}

inspectPrestige().catch(console.error);
