
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function find() {
  console.log('--- DB FUNCTION SEARCH ---');
  // Use a raw SQL query via a known working RPC (like eval if it exists, but it failed).
  // Actually, let's just try to call it with POSITIONAL arguments.
  
  const coords = [36.6269, 126.7647, 30000]; // lat, lng, radius
  try {
    const { data, error } = await supabase.rpc('get_master_places_in_radius', {
      target_lat: 36.6269,
      target_lng: 126.7647,
      radius_meters: 30000,
      target_category: 'RESTAURANT',
      limit_count: 5
    });
    console.log('Attempt 1 (target_category):', error?.message || `Success: ${data?.length}`);
    
    const { data: d2, error: e2 } = await supabase.rpc('get_master_places_in_radius', {
      target_lat: 36.6269,
      target_lng: 126.7647,
      radius_meters: 30000,
      p_category: 'RESTAURANT',
      limit_count: 5
    });
    console.log('Attempt 2 (p_category):', e2?.message || `Success: ${d2?.length}`);
    
  } catch (e) {
    console.log('Exception:', e.message);
  }
}
find();
