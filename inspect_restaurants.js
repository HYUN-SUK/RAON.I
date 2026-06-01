const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log("Checking 동흥루 and 동흥대반점 in master_places via spatial RPC...");
  
  const { data, error } = await supabase.rpc('get_master_places_in_radius_v2', {
    target_lat: 36.6354349,
    target_lng: 126.7638091,
    radius_meters: 30000,
    p_category: 'RESTAURANT',
    limit_count: 1000
  });
    
  if (error) {
    console.error("DB Error:", error.message);
    return;
  }
  
  const filtered = data.filter(r => r.name.includes('동흥'));
  console.log(`Found ${filtered.length} matched records near campground.`);
  filtered.forEach((r, idx) => {
    console.log(`\n[Record ${idx + 1}]`);
    console.log(`  ID:         ${r.id}`);
    console.log(`  Name:       ${r.name}`);
    console.log(`  Address:    "${r.address}"`);
    console.log(`  ApiSource:  "${r.api_source}"`);
    console.log(`  Lat/Lng:    (${r.lat}, ${r.lng})`);
    console.log(`  TrustScore: ${r.trust_score}`);
    console.log(`  raw_data keys: ${Object.keys(r.raw_data || {}).join(', ')}`);
    if (r.raw_data?.badges) {
      console.log(`  badges:     ${JSON.stringify(r.raw_data.badges)}`);
    }
  });
}

main();
