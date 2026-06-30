import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("=== 테스트용 식당(RESTAURANT) 샘플 추출 중 ===");

  // 50건을 가져와 메모리 상에서 3가지 케이스를 정밀하게 분류합니다.
  const { data: places, error } = await supabase
    .from('master_places')
    .select('id, name, address, category, raw_data')
    .eq('category', 'RESTAURANT')
    .eq('is_active', true)
    .limit(100);

  if (error) {
    console.error("Fetch error:", error.message);
    return;
  }

  let caseA = null;
  let caseB = null;
  let caseC = null;

  for (const p of places) {
    const raw = p.raw_data || {};
    const isEnriched = raw.enriched === true;

    if (isEnriched) {
      const hasMenu = Array.isArray(raw.representative_menu) && raw.representative_menu.length > 0;
      const hasHours = !!raw.operating_hours;
      
      if (hasMenu && hasHours && !caseA) {
        caseA = p;
      } else if ((!hasMenu || !hasHours) && !caseB) {
        caseB = p;
      }
    } else {
      if (!caseC) {
        caseC = p;
      }
    }

    if (caseA && caseB && caseC) break;
  }

  console.log("\n[CASE A: 상세정보 완비]");
  console.log(JSON.stringify(caseA, null, 2));

  console.log("\n[CASE B: 상세정보 일부 누락]");
  console.log(JSON.stringify(caseB, null, 2));

  console.log("\n[CASE C: 상세정보 전무 (Fallback)]");
  console.log(JSON.stringify(caseC, null, 2));

}

main();
