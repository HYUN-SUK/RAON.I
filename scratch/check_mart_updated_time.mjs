import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("=== 🔍 마트(MART) 데이터 적재 타임스탬프 실사 시작 ===");
  let lastId = '';
  const marts = [];

  while (true) {
    let query = supabase
      .from('master_places')
      .select('id, name, updated_at, description, raw_data, category, is_active')
      .order('id')
      .limit(4000);

    if (lastId) {
      query = query.gt('id', lastId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Fetch error:", error.message);
      break;
    }
    if (!data || data.length === 0) break;

    for (const m of data) {
      if (
        m.category === 'MART' &&
        m.is_active === true &&
        m.description !== null &&
        m.description !== '' &&
        m.raw_data?.description_api_source !== 'LOCAL_FALLBACK'
      ) {
        marts.push(m);
        if (marts.length >= 5) break;
      }
    }

    if (marts.length >= 5) break;
    lastId = data[data.length - 1].id;
  }

  if (marts.length === 0) {
    console.log("Gemini로 적재 완료된 마트 데이터를 찾을 수 없습니다.");
    return;
  }

  marts.forEach(m => {
    console.log(`- 마트명: ${m.name}`);
    console.log(`  수정시점(updated_at): ${m.updated_at}`);
    console.log(`  API출처(api_source): ${m.raw_data?.description_api_source}`);
    console.log(`  내용: ${m.description}\n`);
  });
}

main();
