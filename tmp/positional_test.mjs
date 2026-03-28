
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function positionalTest() {
  console.log('--- POSITIONAL RPC CALL TEST ---');
  const lat = 36.626909;
  const lng = 126.764786;

  // Supabase rpc with positional args is often passed as single array if the DB function expects it, 
  // but standard JS supabase-js uses object. 
  // We can try to force it by passing an array if the library supports it.
  
  // Or better: Use the NAMES from the SQL file: target_lat, target_lng, radius_meters, target_category, limit_count
  // And try to pass them as strings or numbers.
  const { data, error } = await supabase.rpc('get_master_places_in_radius', {
    target_lat: lat,
    target_lng: lng,
    radius_meters: 30000,
    target_category: 'RESTAURANT',
    limit_count: 5
  });

  if (error) {
    console.error('Positional-ish Fail:', error.message);
  } else {
    console.log(`Success: Found ${data?.length} candidates!`);
  }
}
positionalTest();
