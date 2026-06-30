import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspect() {
  const KST_TODAY_START = '2026-06-23T15:00:00Z'; // 2026-06-24 00:00:00 KST
  console.log(`Analyzing database changes for today (from ${KST_TODAY_START}) split by category...`);

  console.log("Running full-scan to compute precise Category stats for today's updates...");
  let allPlaces = [];
  let lastId = '';
  const limit = 1000;
  let loopCount = 0;
  
  while (true) {
    let query = supabase
      .from('master_places')
      .select('id, category, raw_data, updated_at')
      .order('id')
      .limit(limit);
      
    if (lastId) {
      query = query.gt('id', lastId);
    }
    const { data, error } = await query;
      
    if (error) {
      console.error("Error fetching data:", error.message);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    // 메모리상에서 오늘 업데이트된 공공 카테고리 장소만 필터링
    const targetCats = ['SPOT', 'HOSPITAL', 'FESTIVAL'];
    const filtered = data.filter(p => 
      targetCats.includes(p.category) && 
      p.updated_at >= KST_TODAY_START &&
      p.raw_data?.enriched !== undefined && 
      p.raw_data?.enriched !== null
    );
    
    allPlaces = allPlaces.concat(filtered);
    lastId = data[data.length - 1].id;
    loopCount++;
    
    if (loopCount % 30 === 0) {
      console.log(` -> Scanned ${loopCount * limit} rows... Found ${allPlaces.length} updated places.`);
    }
    
    if (data.length < limit) break;
  }

  const finalStats = {
    SPOT: { success: 0, fail: 0, total: 0 },
    HOSPITAL: { success: 0, fail: 0, total: 0 },
    FESTIVAL: { success: 0, fail: 0, total: 0 }
  };

  allPlaces.forEach(p => {
    const cat = p.category;
    if (finalStats[cat]) {
      const isEnriched = p.raw_data?.enriched;
      if (isEnriched === true) {
        finalStats[cat].success++;
        finalStats[cat].total++;
      } else if (isEnriched === false) {
        finalStats[cat].fail++;
        finalStats[cat].total++;
      }
    }
  });

  console.log("\n=== Precise Today Category Stats ===");
  console.log(JSON.stringify(finalStats, null, 2));
}

inspect();
