import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // raw_data->enriched가 null인 데이터 카운트
  const { data, error } = await s
    .from('master_places')
    .select('id')
    .eq('is_active', true)
    .in('category', ['RESTAURANT', 'MART'])
    .is('raw_data->enriched', null)
    .limit(10);

  if (error) {
    console.error("Filter raw_data->enriched Error:", error.message);
  } else {
    console.log("Found raw_data->enriched IS NULL count:", data.length);
  }
}
main();
