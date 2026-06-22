import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const stats = {
    SPOT: { total: 0, hasKey: 0 },
    HOSPITAL: { total: 0, hasKey: 0 },
    FESTIVAL: { total: 0, hasKey: 0 }
  };
  
  let lastId = null;
  let page = 0;
  let totalScanned = 0;
  
  console.log("Analyzing active public categories (No category filter to prevent timeout)...");
  
  while (true) {
    let q = s.from('master_places')
             .select('id, category, is_active, raw_data')
             .order('id')
             .limit(1000);
    if (lastId) q = q.gt('id', lastId);
    
    const { data, error } = await q;
    if (error) {
      console.error(`Error loading page ${page}:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    
    totalScanned += data.length;
    for (const row of data) {
      if (row.is_active !== true) continue;
      
      const cat = row.category;
      if (stats[cat] !== undefined) {
        stats[cat].total++;
        const raw = row.raw_data || {};
        if (cat === 'SPOT' || cat === 'FESTIVAL') {
          if (raw.contentid || raw.contentId) {
            stats[cat].hasKey++;
          }
        } else if (cat === 'HOSPITAL') {
          if (raw.hpid) {
            stats[cat].hasKey++;
          }
        }
      }
    }
    
    lastId = data[data.length - 1].id;
    page++;
    if (page % 20 === 0) {
      console.log(`Progress: Scanned ${totalScanned} rows from DB...`);
    }
  }
  
  console.log("\n=== 공공 카테고리 데이터 수 집계 결과 ===");
  for (const cat of Object.keys(stats)) {
    const { total, hasKey } = stats[cat];
    console.log(`${cat}: 총 활성 데이터 = ${total} 건 (공공 매핑 ID 보유 = ${hasKey} 건, 미보유 = ${total - hasKey} 건)`);
  }
}

main();
