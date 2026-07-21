import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDbRaw() {
    console.log("=== master_places 9592abd2-f913-585d-a41c-ded6a8f564ce 정밀 진단 ===");
    
    const { data: row, error } = await supabase
        .from('master_places')
        .select('id, name, address, api_source, raw_data')
        .eq('id', '9592abd2-f913-585d-a41c-ded6a8f564ce')
        .single();

    if (error) {
        console.error("에러:", error.message);
        return;
    }

    console.log("DB 데이터:");
    console.log(JSON.stringify(row, null, 2));
}

checkDbRaw();
