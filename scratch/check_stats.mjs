import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const stats = {
    RESTAURANT: { total: 0, enriched: 0, fallback: 0, noFlag: 0 },
    MART: { total: 0, enriched: 0, fallback: 0, noFlag: 0 },
    SPOT: { total: 0, enriched: 0, fallback: 0, noFlag: 0 },
    HOSPITAL: { total: 0, enriched: 0, fallback: 0, noFlag: 0 },
    FESTIVAL: { total: 0, enriched: 0, fallback: 0, noFlag: 0 }
  };
  
  let lastId = null;
  let page = 0;
  let totalScanned = 0;
  
  console.log("Scanning master_places table using sequential cursor pagination (No filter on category)...");

  while (true) {
    let q = s.from('master_places')
             .select('id, category, is_active, raw_data')
             .order('id')
             .limit(1000);
    if (lastId) q = q.gt('id', lastId);
    
    const { data, error } = await q;
    if (error) {
      console.error(`Error fetching page ${page}:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;

    totalScanned += data.length;
    for (const row of data) {
      if (row.is_active !== true) continue;
      
      const cat = row.category;
      if (stats[cat] !== undefined) {
        stats[cat].total++;
        const isEnriched = row.raw_data?.enriched;
        if (isEnriched === true) {
          stats[cat].enriched++;
        } else if (isEnriched === false) {
          stats[cat].fallback++;
        } else {
          stats[cat].noFlag++;
        }
      }
    }
    
    lastId = data[data.length - 1].id;
    page++;
    if (page % 20 === 0) {
      console.log(`Progress: Scanned ${totalScanned} rows from DB...`);
    }
  }

  let gt = 0, gd = 0, gf = 0, gn = 0;
  console.log("\n=== 점검 결과 ===");
  for (const c of Object.keys(stats)) {
    const { total, enriched, fallback, noFlag } = stats[c];
    const pctEnriched = total > 0 ? (enriched / total * 100).toFixed(1) : '0.0';
    const pctFallback = total > 0 ? (fallback / total * 100).toFixed(1) : '0.0';
    console.log(`${c}: 총=${total}, 상세완료=${enriched} (${pctEnriched}%), 폴백=${fallback} (${pctFallback}%), 미시도=${noFlag}`);
    gt += total; gd += enriched; gf += fallback; gn += noFlag;
  }
  
  const pctTotalEnriched = gt > 0 ? (gd / gt * 100).toFixed(1) : '0.0';
  const pctTotalFallback = gt > 0 ? (gf / gt * 100).toFixed(1) : '0.0';
  console.log(`\n합계: 총=${gt}, 상세완료=${gd} (${pctTotalEnriched}%), 폴백/실패=${gf} (${pctTotalFallback}%), 미시도=${gn}`);
}
main();
