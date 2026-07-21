import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInQuery() {
    console.log("=== master_places SAFE_RESTAURANT .in() vs .eq() 비교 점검 ===");
    
    // .eq('sido', '경기도') count
    const { count: eqCount, error: err1 } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .eq('sido', '경기도')
        .eq('api_source', 'SAFE_RESTAURANT')
        .eq('is_active', true);

    // .in('sido', ['경기도', '경기']) count
    const { count: inCount, error: err2 } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .in('sido', ['경기도', '경기'])
        .eq('api_source', 'SAFE_RESTAURANT')
        .eq('is_active', true);

    console.log(`.eq('sido', '경기도') 결과: ${eqCount}건`);
    console.log(`.in('sido', ['경기도', '경기']) 결과: ${inCount}건`);
    if (err1) console.error("eq 에러:", err1.message);
    if (err2) console.error("in 에러:", err2.message);
}

checkInQuery();
