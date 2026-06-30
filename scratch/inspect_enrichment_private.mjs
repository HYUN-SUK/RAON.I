import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase configuration");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log("Analyzing private categories enrichment status (RESTAURANT, ROUTE_CAFE, MART)...");

  let allPlaces = [];
  let lastId = '';
  const limit = 1000;
  let loopCount = 0;
  
  while (true) {
    let query = supabase
      .from('master_places')
      .select('id, name, category, raw_data, is_active')
      .order('id')
      .limit(limit);
      
    if (lastId) {
      query = query.gt('id', lastId);
    }
    const { data, error } = await query;
      
    if (error) {
      console.error("Error fetching data:", error.message);
      process.exit(1);
    }
    
    if (!data || data.length === 0) break;
    
    const filtered = data.filter(p => ['RESTAURANT', 'ROUTE_CAFE', 'MART'].includes(p.category));
    allPlaces = allPlaces.concat(filtered);
    lastId = data[data.length - 1].id;
    loopCount++;
    
    if (loopCount % 50 === 0) {
      console.log(` -> Scanned ${loopCount * limit} rows... Found ${allPlaces.length} private places.`);
    }
    
    if (data.length < limit) break;
  }

  console.log(`Total private category places retrieved: ${allPlaces.length}`);

  const stats = {
    RESTAURANT: { total: 0, activeTotal: 0, activeEnriched: 0, activeFailed: 0, activePending: 0, inactiveTotal: 0 },
    ROUTE_CAFE: { total: 0, activeTotal: 0, activeEnriched: 0, activeFailed: 0, activePending: 0, inactiveTotal: 0 },
    MART: { total: 0, activeTotal: 0, activeEnriched: 0, activeFailed: 0, activePending: 0, inactiveTotal: 0 }
  };

  const failedSample = [];

  allPlaces.forEach(p => {
    const cat = p.category;
    if (stats[cat]) {
      stats[cat].total++;
      const isActive = p.is_active === true;
      if (isActive) {
        stats[cat].activeTotal++;
        const raw = p.raw_data || {};
        
        // 상세정보 수집 성공 판정: raw.enriched === true 또는 raw.operating_hours 가 존재
        const isEnriched = raw.enriched === true || (raw.operating_hours && raw.operating_hours !== "정보 없음 (방문 전 확인 권장)" && raw.operating_hours !== "평일 09:00 - 18:00 (전화 확인 권장)");
        
        // 실패 판정: raw.enriched === false 또는 카카오맵 매칭 불가로 miss_count 존재
        const isFailed = raw.enriched === false || raw.miss_count > 0 || raw.crawl_error;

        if (isEnriched) {
          stats[cat].activeEnriched++;
        } else if (isFailed) {
          stats[cat].activeFailed++;
          if (failedSample.length < 5) {
            failedSample.push({ name: p.name, category: cat, raw_data: raw });
          }
        } else {
          stats[cat].activePending++;
        }
      } else {
        stats[cat].inactiveTotal++;
      }
    }
  });

  console.log("\n=== Statistics (RESTAURANT, ROUTE_CAFE, MART) ===");
  console.log(JSON.stringify(stats, null, 2));

  console.log("\n=== Failed Samples (Crawl / Match Failures) ===");
  failedSample.forEach((fs, idx) => {
    console.log(`[Sample #${idx + 1}] Name: ${fs.name} | Cat: ${fs.category}`);
    console.log(`  Reason/State: ${JSON.stringify(fs.raw_data)}`);
  });

  console.log("\n=== Summary Table (Active Places Only) ===");
  console.log("| Category | Active Total | Enriched (Success) | Failed / Unmatched | Pending (Not Tried) | Progress Rate |");
  console.log("| --- | --- | --- | --- | --- | --- |");
  
  Object.keys(stats).forEach(cat => {
    const s = stats[cat];
    const rate = s.activeTotal > 0 ? ((s.activeEnriched / s.activeTotal) * 100).toFixed(1) : "0.0";
    console.log(`| ${cat} | ${s.activeTotal} | ${s.activeEnriched} | ${s.activeFailed} | ${s.activePending} | ${rate}% |`);
  });

  process.exit(0);
}

main();
