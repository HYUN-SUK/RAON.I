
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function extract() {
  console.log('--- 3/31 Target Extraction Audit ---');
  const targetLat = 36.626909;
  const targetLng = 126.764786;
  const radius = 30000;
  
  // 1. Check RPC exactly
  const { data, error } = await supabase.rpc('get_master_places_in_radius', {
    target_lat: targetLat,
    target_lng: targetLng,
    radius_meters: radius,
    target_category: 'RESTAURANT',
    limit_count: 300
  });

  if (error) {
    console.error('RPC ERROR:', error.message);
  } else {
    console.log(`Extraction Success: ${data?.length || 0} RESTAURANTS found.`);
    if (data?.length > 0) {
      console.log('Sample RESTAURANT:', data[0].name, data[0].address);
    }
  }

  const { data: spotData, error: spotError } = await supabase.rpc('get_master_places_in_radius', {
    target_lat: targetLat,
    target_lng: targetLng,
    radius_meters: radius,
    target_category: 'SPOT',
    limit_count: 300
  });
  
  if (spotError) {
    console.error('SPOT RPC ERROR:', spotError.message);
  } else {
    console.log(`Extraction Success: ${spotData?.length || 0} SPOTS found.`);
  }
}
extract();
