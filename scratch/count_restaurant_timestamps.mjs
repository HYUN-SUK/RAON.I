import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("=== 🔍 식당(RESTAURANT) 데이터 적재일자별 분포 실사 시작 ===");

  let lastId = '';
  const dateCounts = {};
  let totalCount = 0;

  while (true) {
    let query = supabase
      .from('master_places')
      .select('id, category, description, updated_at, raw_data')
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

    for (const p of data) {
      if (
        p.category === 'RESTAURANT' &&
        p.description !== null &&
        p.description !== '' &&
        p.raw_data?.description_api_source !== 'LOCAL_FALLBACK'
      ) {
        totalCount++;
        // YYYY-MM-DD 형식으로 날짜 파싱
        const dateStr = p.updated_at ? p.updated_at.substring(0, 10) : '날짜없음';
        dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
      }
    }

    lastId = data[data.length - 1].id;
  }

  console.log(`\n==================================================`);
  console.log(`📊 [식당 Gemini 요약 데이터 적재 날짜별 전수 분포]`);
  console.log(`- 총 적재 건수: ${totalCount} 건`);
  console.log(`--------------------------------------------------`);
  Object.keys(dateCounts).sort().forEach(date => {
    console.log(`- ${date} 적재분: ${dateCounts[date]} 건`);
  });
  console.log(`==================================================\n`);
}

main();
