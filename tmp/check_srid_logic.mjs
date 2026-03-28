
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSrid() {
  console.log('--- SRID & Geography Check ---');
  // Use a query that calls ST_SRID in a select (if the table has geom/location)
  // But wait! We can just look at the AsText result
  const { data, error } = await supabase.from('master_places')
    .select('name, address, lat, lng')
    .ilike('address', '%예산군%')
    .limit(1);

  if (data?.[0]) {
    console.log(`Checking record: ${data[0].name}`);
    console.log(`Coords: ${data[0].lat}, ${data[0].lng}`);
    
    // Test the RPC again with very broad parameters
    const { data: d2, error: e2 } = await supabase.rpc('get_master_places_in_radius', {
      target_lat: data[0].lat,
      target_lng: data[0].lng,
      radius_meters: 5000, // 5km 
      target_category: null, // Any category
      limit_count: 5
    });
    console.log('RPC result with broad params:', d2?.length, e2?.message);
  }
}
checkSrid();
