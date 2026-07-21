import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNullActive() {
    console.log("=== master_places is_active IS NULL 데이터 점검 ===");
    
    // 경기도 SAFE_RESTAURANT 중 is_active가 null인 데이터 개수 조회
    const { count, error } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .eq('sido', '경기도')
        .eq('api_source', 'SAFE_RESTAURANT')
        .is('is_active', null);

    if (error) {
        console.error("에러:", error.message);
        return;
    }

    console.log(`경기도 SAFE_RESTAURANT 중 is_active가 NULL인 데이터 개수: ${count}건`);

    // 전체 카테고리/소스 통틀어서 is_active가 null인 데이터 개수 조회
    const { count: totalNull, error: err2 } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .is('is_active', null);

    if (!err2) {
        console.log(`DB 전체에서 is_active가 NULL인 데이터 개수: ${totalNull}건`);
    }
}

checkNullActive();
