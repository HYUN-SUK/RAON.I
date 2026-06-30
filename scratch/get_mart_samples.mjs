import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("=== 🛒 마트(MART) 카테고리 상세정보 샘플 추출 중 ===");

  // 1. 상세정보가 완비된 마트 샘플 3건 조회 (is_active = true 이고 enriched = true)
  const { data: marts, error } = await supabase
    .from('master_places')
    .select('id, name, address, category, raw_data')
    .eq('category', 'MART')
    .eq('is_active', true)
    .eq('raw_data->enriched', true)
    .not('raw_data->operating_hours', 'is', null)
    .limit(3);

  if (error) {
    console.error("마트 샘플 조회 실패:", error.message);
    return;
  }

  console.log(JSON.stringify(marts, null, 2));
}

main();
