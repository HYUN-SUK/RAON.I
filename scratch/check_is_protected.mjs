import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function checkIsProtectedCount() {
    const { count, error } = await supabase
        .from('master_places')
        .select('id', { count: 'exact' })
        .eq('is_protected', true)
        .limit(1);

    console.log(`master_places is_protected = true count: ${count}, error:`, error);
}

checkIsProtectedCount();
