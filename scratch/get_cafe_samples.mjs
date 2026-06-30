import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("=== ☕ 카페(ROUTE_CAFE) 카테고리 상세정보 샘플 추출 중 ===");

  // 1. 카페 샘플 3건 조회 (is_active = true)
  const { data: cafes, error } = await supabase
    .from('master_places')
    .select('id, name, address, category, raw_data')
    .eq('category', 'ROUTE_CAFE')
    .eq('is_active', true)
    .limit(3);

  if (error) {
    console.error("카페 샘플 조회 실패:", error.message);
    return;
  }

  console.log(JSON.stringify(cafes, null, 2));
}

main();
