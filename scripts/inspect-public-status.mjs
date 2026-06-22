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

async function inspectStatus() {
  console.log("Analyzing public categories enrichment status (SPOT, HOSPITAL, FESTIVAL)...");

  // 0. 테이블 전체 레코드 수 조회
  const { count: grandTotalCount, error: countErr } = await supabase
    .from('master_places')
    .select('*', { count: 'exact', head: true });
    
  if (countErr) {
    console.error("Error counting total places:", countErr.message);
  } else {
    console.log(`Grand total rows in master_places: ${grandTotalCount}`);
  }

  // 1. 전체 활성 장소 목록 가져오기 (메모리 누수 방지 위해 select ID, category, raw_data 만 조회)
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
    
    const filtered = data.filter(p => ['SPOT', 'HOSPITAL', 'FESTIVAL'].includes(p.category));
    allPlaces = allPlaces.concat(filtered);
    lastId = data[data.length - 1].id;
    loopCount++;
    
    if (loopCount % 20 === 0) {
      console.log(` -> Scanned ${loopCount * limit} rows... Found ${allPlaces.length} public places.`);
    }
    
    if (data.length < limit) break;
  }

  console.log(`Total public category places retrieved: ${allPlaces.length}`);

  // 통계 계산
  const stats = {
    SPOT: { total: 0, activeTotal: 0, activeEnriched: 0, activeFailed: 0, activePending: 0, inactiveTotal: 0 },
    HOSPITAL: { total: 0, activeTotal: 0, activeEnriched: 0, activeFailed: 0, activePending: 0, inactiveTotal: 0 },
    FESTIVAL: { total: 0, activeTotal: 0, activeEnriched: 0, activeFailed: 0, activePending: 0, inactiveTotal: 0 }
  };

  const failedPlacesList = [];

  allPlaces.forEach(p => {
    const cat = p.category;
    if (stats[cat]) {
      stats[cat].total++;
      const isActive = p.is_active === true;
      if (isActive) {
        stats[cat].activeTotal++;
        const isEnriched = p.raw_data?.enriched;
        if (isEnriched === true) {
          stats[cat].activeEnriched++;
        } else if (isEnriched === false) {
          stats[cat].activeFailed++;
          failedPlacesList.push({ id: p.id, name: p.name || 'Unknown', category: cat });
        } else {
          stats[cat].activePending++;
        }
      } else {
        stats[cat].inactiveTotal++;
      }
    }
  });

  console.log("\n=== Detailed Statistics ===");
  console.log(JSON.stringify(stats, null, 2));

  if (failedPlacesList.length > 0) {
    console.log("\n=== Failed Places Details ===");
    failedPlacesList.forEach((fp, idx) => {
      console.log(`[Failed #${idx + 1}] ID: ${fp.id} | Name: ${fp.name} | Category: ${fp.category}`);
    });
  }

  console.log("\n=== Summary Table (Active Places Only) ===");
  console.log("| Category | Active Total | Enriched (Success) | Failed | Pending (Not Tried) | Progress Rate |");
  console.log("| --- | --- | --- | --- | --- | --- |");
  
  Object.keys(stats).forEach(cat => {
    const s = stats[cat];
    const rate = s.activeTotal > 0 ? ((s.activeEnriched / s.activeTotal) * 100).toFixed(1) : "0.0";
    console.log(`| ${cat} | ${s.activeTotal} | ${s.activeEnriched} | ${s.activeFailed} | ${s.activePending} | ${rate}% |`);
  });

  console.log("\n=== Summary Table (Inactive/All Places) ===");
  console.log("| Category | Grand Total | Active | Inactive/Other |");
  console.log("| --- | --- | --- | --- |");
  Object.keys(stats).forEach(cat => {
    const s = stats[cat];
    console.log(`| ${cat} | ${s.total} | ${s.activeTotal} | ${s.inactiveTotal} |`);
  });
}

inspectStatus();
