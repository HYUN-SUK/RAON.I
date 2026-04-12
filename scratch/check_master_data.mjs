import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkData() {
    const { data, error } = await supabase
        .from('master_places')
        .select('sido, sigungu, raw_data->contentid, name')
        .eq('api_source', 'TOUR_SPOT')
        .limit(10);
    
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}

checkData();
