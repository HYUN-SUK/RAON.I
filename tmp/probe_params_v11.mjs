
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function probeParams() {
  console.log('--- Probing RPC Parameter Names (target vs p) ---');
  const lat = 36.626909;
  const lng = 126.764786;

  const test1 = { target_lat: lat, target_lng: lng, radius_meters: 30000, target_category: 'RESTAURANT', limit_count: 5 };
  const test2 = { target_lat: lat, target_lng: lng, radius_meters: 30000, p_category: 'RESTAURANT', limit_count: 5 };
  
  const { data: d1, error: e1 } = await supabase.rpc('get_master_places_in_radius', test1);
  console.log('Test with target_category:', e1 ? e1.message : `Success: ${d1.length}`);
  
  const { data: d2, error: e2 } = await supabase.rpc('get_master_places_in_radius', test2);
  console.log('Test with p_category:', e2 ? e2.message : `Success: ${d2.length}`);
}
probeParams();
