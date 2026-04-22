import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectItem() {
    console.log('--- Inspecting landmarks in master_places ---');
    
    // Using exact match to avoid timeout
    const { data, error } = await supabase
        .from('master_places')
        .select('*')
        .in('name', ['대흥향교', '예당호 출렁다리'])
        .eq('sigungu', '예산군');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(JSON.stringify(data, null, 2));
}

inspectItem().catch(console.error);
