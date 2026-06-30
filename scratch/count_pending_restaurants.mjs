import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("=== ⏳ 식당(RESTAURANT) 카테고리 잔여 펜딩 건수 조회 중 ===");

  // 1. 활성(is_active = true)이고 식당(RESTAURANT)인 전체 레코드 수
  const { count: totalActiveCount, error: err1 } = await supabase
    .from('master_places')
    .select('id', { count: 'exact' })
    .eq('category', 'RESTAURANT')
    .eq('is_active', true)
    .limit(1);

  // 2. 아직 1줄 설명 적재가 진행되지 않은 남은 펜딩 식당 수 (description IS NULL)
  const { count: pendingCount, error: err2 } = await supabase
    .from('master_places')
    .select('id', { count: 'exact' })
    .eq('category', 'RESTAURANT')
    .eq('is_active', true)
    .is('description', null)
    .limit(1);

  if (err1 || err2) {
    console.error("오류 발생 (상세):", JSON.stringify({ err1, err2 }, null, 2));
    return;
  }

  const enrichedCount = totalActiveCount - pendingCount;

  console.log(`\n==================================================`);
  console.log(`📊 [식당 카테고리 적재 현황]`);
  console.log(`- 전체 활성 식당 수: ${totalActiveCount} 건`);
  console.log(`- 적재 완수 식당 수: ${enrichedCount} 건`);
  console.log(`- 남은 펜딩 식당 수: ${pendingCount} 건`);
  console.log(`==================================================\n`);
}

main();
