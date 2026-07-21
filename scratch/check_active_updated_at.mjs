import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkActiveUpdatedAt() {
    console.log("=== master_places active SAFE_RESTAURANT id 및 updated_at 점검 ===");
    
    const { data: samples, error } = await supabase
        .from('master_places')
        .select('id, name, address, is_active, updated_at')
        .eq('sido', '경기도')
        .eq('api_source', 'SAFE_RESTAURANT')
        .eq('is_active', true)
        .limit(5);

    if (error) {
        console.error("에러:", error.message);
        return;
    }

    samples.forEach(s => {
        console.log(`- [${s.name}]`);
        console.log(`  주소: ${s.address}`);
        console.log(`  DB id: ${s.id}`);
        console.log(`  updated_at: ${s.updated_at}`);
    });
}

checkActiveUpdatedAt();
