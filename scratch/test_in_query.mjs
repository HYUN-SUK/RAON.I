import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInQuery() {
    console.log("=== IN 쿼리 테스트 ===");
    
    const aliases = ['경기도', '경기'];
    const source = 'SAFE_RESTAURANT';
    
    const { count: actCount, error: actErr } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .in('sido', aliases)
        .eq('api_source', source)
        .eq('is_active', true);
        
    const { count: inactCount, error: inactErr } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .in('sido', aliases)
        .eq('api_source', source)
        .eq('is_active', false);

    console.log("Active Error:", actErr);
    console.log("Active Count:", actCount);
    console.log("Inactive Error:", inactErr);
    console.log("Inactive Count:", inactCount);
}

testInQuery();
