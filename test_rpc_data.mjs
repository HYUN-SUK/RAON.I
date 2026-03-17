
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const target = '2026-03-20';
  const { data: resv } = await supabase
    .from('user_schedules')
    .select('*')
    .eq('check_in', target)
    .limit(1);
  
  if (!resv || resv.length === 0) {
    console.log('No reservation found');
    return;
  }

  const { campground_lat, campground_lng, campground_name } = resv[0];
  console.log(`Checking around ${campground_name} (${campground_lat}, ${campground_lng})...`);

  const { data: near, error } = await supabase.rpc('get_master_places_in_radius', {
    target_lat: campground_lat,
    target_lng: campground_lng,
    radius_meters: 30000, // 30km
    limit_count: 10
  });

  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log(`Found ${near?.length || 0} master places within 30km.`);
    if (near && near.length > 0) {
      console.log('Sample near place:', near[0].name, near[0].distance_meters);
    }
  }
}
check();
