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
  console.log("Analyzing public categories enrichment status (SPOT, HOSPITAL, FESTIVAL)...");

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
    
    if (loopCount % 50 === 0) {
      console.log(` -> Scanned ${loopCount * limit} rows... Found ${allPlaces.length} public places.`);
    }
    
    if (data.length < limit) break;
  }

  console.log(`Total public category places retrieved: ${allPlaces.length}`);

  const stats = {
    SPOT: { total: 0, activeTotal: 0, activeEnriched: 0, activeFailed: 0, activePending: 0, inactiveTotal: 0 },
    HOSPITAL: { total: 0, activeTotal: 0, activeEnriched: 0, activeFailed: 0, activePending: 0, inactiveTotal: 0 },
    FESTIVAL: { total: 0, activeTotal: 0, activeEnriched: 0, activeFailed: 0, activePending: 0, inactiveTotal: 0 }
  };

  const failedSample = [];
  const enrichedSample = [];

  allPlaces.forEach(p => {
    const cat = p.category;
    if (stats[cat]) {
      stats[cat].total++;
      const isActive = p.is_active === true;
      if (isActive) {
        stats[cat].activeTotal++;
        const raw = p.raw_data || {};
        
        // 상세정보 수집 성공 판정: raw.enriched === true
        const isEnriched = raw.enriched === true;
        
        // 실패 판정: raw.enriched === false 또는 에러 필드 존재
        const isFailed = raw.enriched === false || raw.enrich_error;

        if (isEnriched) {
          stats[cat].activeEnriched++;
          if (enrichedSample.filter(x => x.category === cat).length < 2) {
            enrichedSample.push({ name: p.name, category: cat, raw_data: raw });
          }
        } else if (isFailed) {
          stats[cat].activeFailed++;
          if (failedSample.filter(x => x.category === cat).length < 3) {
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

  console.log("\n=== Statistics (SPOT, HOSPITAL, FESTIVAL) ===");
  console.log(JSON.stringify(stats, null, 2));

  console.log("\n=== Enriched Samples (Real Data Content) ===");
  enrichedSample.forEach((es, idx) => {
    console.log(`[Enriched Sample #${idx + 1}] Name: ${es.name} | Cat: ${es.category}`);
    console.log(`  Data: ${JSON.stringify({
      operating_hours: es.raw_data.operating_hours,
      closed_days: es.raw_data.closed_days,
      parking_available: es.raw_data.parking_available,
      admission_fee: es.raw_data.admission_fee,
      kids_friendly: es.raw_data.kids_friendly,
      disabled_accessible: es.raw_data.disabled_accessible,
      emergency_room: es.raw_data.emergency_room,
      representative_departments: es.raw_data.representative_departments,
      festival_period: es.raw_data.festival_period
    }, null, 2)}`);
  });

  console.log("\n=== Failed Samples (API Error or Unmatched) ===");
  failedSample.forEach((fs, idx) => {
    console.log(`[Failed Sample #${idx + 1}] Name: ${fs.name} | Cat: ${fs.category}`);
    console.log(`  Reason/State: ${JSON.stringify(fs.raw_data)}`);
  });

  console.log("\n=== Summary Table (Active Places Only) ===");
  console.log("| Category | Active Total | Enriched (Success) | Failed (Fallback) | Pending (Not Tried) | Progress Rate |");
  console.log("| --- | --- | --- | --- | --- | --- |");
  
  Object.keys(stats).forEach(cat => {
    const s = stats[cat];
    const rate = s.activeTotal > 0 ? ((s.activeEnriched / s.activeTotal) * 100).toFixed(1) : "0.0";
    console.log(`| ${cat} | ${s.activeTotal} | ${s.activeEnriched} | ${s.activeFailed} | ${s.activePending} | ${rate}% |`);
  });

  process.exit(0);
}

main();
