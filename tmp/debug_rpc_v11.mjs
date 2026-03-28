
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debug() {
  const targetLat = 36.626909;
  const targetLng = 126.764786;
  const categories = [
    { cat: 'RESTAURANT', limit: 300 },
    { cat: 'SPOT', limit: 300 }
  ];

  console.log('--- Testing RPC EXACTLY like the script ---');
  for (const { cat, limit } of categories) {
    console.log(`Pulling ${cat} with limit ${limit}...`);
    const { data, error } = await supabase.rpc('get_master_places_in_radius', {
      target_lat: targetLat,
      target_lng: targetLng,
      radius_meters: 30000,
      limit_count: limit,
      target_category: cat
    });
    if (error) {
      console.log(`[FAIL] ${cat}:`, error.message);
    } else {
      console.log(`[SUCCESS] ${cat}: Discovered ${data?.length || 0} candidates`);
      if (data?.length > 0) {
        console.log(`   Sample: ${data[0].name} | ${data[0].address}`);
      }
    }
  }
}
debug();
