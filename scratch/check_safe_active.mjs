import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSafeActive() {
    console.log("=== master_places SAFE_RESTAURANT is_active 분포 점검 ===");
    
    // 경기도 SAFE_RESTAURANT 전체 count
    const { count: total, error: err1 } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .eq('sido', '경기도')
        .eq('api_source', 'SAFE_RESTAURANT');

    // active count
    const { count: active, error: err2 } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .eq('sido', '경기도')
        .eq('api_source', 'SAFE_RESTAURANT')
        .eq('is_active', true);

    // inactive count
    const { count: inactive, error: err3 } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .eq('sido', '경기도')
        .eq('api_source', 'SAFE_RESTAURANT')
        .eq('is_active', false);

    console.log(`경기도 안심식당 전체: ${total}건`);
    console.log(`경기도 안심식당 Active (영업중): ${active}건`);
    console.log(`경기도 안심식당 Inactive (인증취소/비활성): ${inactive}건`);
}

checkSafeActive();
