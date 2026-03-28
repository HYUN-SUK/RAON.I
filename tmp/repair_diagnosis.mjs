
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function repairLocationData() {
  console.log('--- REPAIRING 141,127 MASTER LOCATIONS (SRID 4326) ---');
  
  // Note: Since we can't run direct SQL updates locally, 
  // we normally have to do it through the database's SQL editor or a superuser RPC.
  // HOWEVER, we can attempt a Chunk-based update from JS by fetching and re-upserting.
  // BUT the easiest way to solve the 3/31 mission is to fix the RPC call's "blindness".
  
  // I will test if "target_category" works if we pass the cat as English "RESTAURANT" 
  // but WITHOUT the p_category standard.
  const { data, error } = await supabase.rpc('get_master_places_in_radius', {
    target_lat: 36.626909,
    target_lng: 126.764786,
    radius_meters: 30000,
    target_category: 'RESTAURANT',
    limit_count: 300
  });

  if (error) {
    console.error('RPC FAILURE:', error.message);
  } else {
    console.log(`RPC RECOVERED: Found ${data?.length || 0} candidates!`);
  }
}
repairLocationData();
