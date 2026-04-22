import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkCount() {
    const { count, error } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .eq('category', 'SPOT');
    
    console.log(`Total SPOT items: ${count}`);
    
    const { data: sample } = await supabase
        .from('master_places')
        .select('name, category, sido, sigungu')
        .eq('category', 'SPOT')
        .limit(10);
    
    console.log('Sample SPOT items:', JSON.stringify(sample, null, 2));
}

checkCount().catch(console.error);
