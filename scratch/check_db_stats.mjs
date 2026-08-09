import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("📊 [DB Stats Check] Probing master_places table...");
  
  // 1. Total row count (Approximate or paginated if needed, let's try a simple estimate or head)
  const startTime = Date.now();
  const { count, error: countErr } = await supabase
    .from('master_places')
    .select('*', { count: 'estimated', head: true });
    
  if (countErr) {
    console.error("💥 Count error:", countErr.message);
  } else {
    console.log(`✅ Approximate total rows in master_places: ${count}`);
  }
  
  // 2. Test JSONB query performance
  console.log("\n⚡ Testing JSONB query performance (raw_data->>contentid)...");
  const testContentId = "2749170"; // A standard spot contentId
  
  const qStartTime = Date.now();
  const { data, error: qErr } = await supabase
    .from('master_places')
    .select('id')
    .filter('raw_data->>contentid', 'eq', testContentId)
    .limit(1);
    
  const qDuration = Date.now() - qStartTime;
  
  if (qErr) {
    console.error("❌ Query error:", qErr.message);
  } else {
    console.log(`✅ Query returned: ${JSON.stringify(data)}`);
    console.log(`⏳ Single JSONB query duration: ${qDuration}ms`);
  }

  // 3. Test Gyeonggi spots count
  console.log("\n⚡ Counting spots in Gyeonggi-do...");
  const gStartTime = Date.now();
  const { count: ggCount, error: ggErr } = await supabase
    .from('master_places')
    .select('id', { count: 'exact', head: true })
    .eq('sido', '경기도')
    .eq('api_source', 'TOUR_SPOT');

  const gDuration = Date.now() - gStartTime;
  if (ggErr) {
    console.error("❌ Gyeonggi count error:", ggErr.message);
  } else {
    console.log(`✅ Gyeonggi TOUR_SPOT rows: ${ggCount}`);
    console.log(`⏳ Gyeonggi count query duration: ${gDuration}ms`);
  }
}

run();
