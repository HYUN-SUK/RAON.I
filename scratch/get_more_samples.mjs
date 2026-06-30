import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("=== 추가 테스트용 상세정보 완비 샘플 추출 중 ===");

  // 1. 식당(RESTAURANT) 추가 2건
  const { data: restaurants } = await supabase
    .from('master_places')
    .select('id, name, address, category, raw_data')
    .eq('category', 'RESTAURANT')
    .eq('is_active', true)
    .eq('raw_data->enriched', true)
    .not('raw_data->operating_hours', 'is', null)
    .not('raw_data->representative_menu', 'is', null)
    .limit(5);

  // 2. 마트(MART) 상세 완비 1건
  const { data: marts } = await supabase
    .from('master_places')
    .select('id, name, address, category, raw_data')
    .eq('category', 'MART')
    .eq('is_active', true)
    .eq('raw_data->enriched', true)
    .not('raw_data->operating_hours', 'is', null)
    .limit(3);

  // 3. 관광명소(SPOT) 상세 완비 1건
  const { data: spots } = await supabase
    .from('master_places')
    .select('id, name, address, category, raw_data')
    .eq('category', 'SPOT')
    .eq('is_active', true)
    .eq('raw_data->enriched', true)
    .limit(3);

  console.log("\n[RESTAURANT EXTRA SAMPLES]");
  // 첫 번째 장수촌 제외하고 뒤쪽 2건 출력
  const extraRests = restaurants ? restaurants.slice(1, 3) : [];
  console.log(JSON.stringify(extraRests, null, 2));

  console.log("\n[MART SAMPLE]");
  console.log(JSON.stringify(marts?.[0], null, 2));

  console.log("\n[SPOT SAMPLE]");
  console.log(JSON.stringify(spots?.[0], null, 2));
}

main();
