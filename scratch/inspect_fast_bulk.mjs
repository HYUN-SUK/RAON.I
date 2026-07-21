import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectFastBulk() {
    console.log("=== FAST_BULK_PLAYWRIGHT 데이터 상세 점검 ===");
    
    const { data: samples, error } = await supabase
        .from('master_places')
        .select('id, name, address, api_source, category, is_active')
        .eq('api_source', 'FAST_BULK_PLAYWRIGHT')
        .limit(5);

    if (error) {
        console.error("에러:", error.message);
        return;
    }

    console.log("샘플 데이터:");
    console.log(JSON.stringify(samples, null, 2));
}

inspectFastBulk();
