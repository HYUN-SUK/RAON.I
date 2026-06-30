import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("=== 🔍 master_places 고유 카테고리 목록 전체 페이징 스캔 시작 ===");
  let lastId = '';
  const uniqueCategories = new Set();

  while (true) {
    let query = supabase
      .from('master_places')
      .select('id, category')
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
      uniqueCategories.add(p.category);
    }

    lastId = data[data.length - 1].id;
  }

  console.log("최종 고유 카테고리 목록:", Array.from(uniqueCategories));
}

main();
