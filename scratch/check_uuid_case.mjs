import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUuidCase() {
    console.log("=== master_places UUID 대소문자 점검 ===");
    
    const { data, error } = await supabase
        .from('master_places')
        .select('id')
        .eq('api_source', 'SAFE_RESTAURANT')
        .limit(5);

    if (error) {
        console.error("에러:", error.message);
        return;
    }

    console.log("샘플 UUID 목록:");
    data.forEach(d => {
        console.log(`- 원본: ${d.id}`);
        console.log(`  소문자 변환과 일치 여부: ${d.id === d.id.toLowerCase()}`);
    });
}

checkUuidCase();
