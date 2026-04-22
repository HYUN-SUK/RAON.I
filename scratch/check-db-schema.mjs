import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
  const { data, error } = await supabase.rpc('get_master_places_in_radius_v2', {
    target_lat: 37.5,
    target_lng: 127.0,
    radius_meters: 1,
    limit_count: 1
  });
  
  if (error) {
    console.error('Error fetching data:', error);
    return;
  }
  
  console.log('Columns in master_places (via RPC):', data.length > 0 ? Object.keys(data[0]) : 'No data found');
  
  // Try to check if is_protected exists
  const { data: cols, error: colError } = await supabase.from('master_places').select('is_protected').limit(1);
  if (colError) {
    console.log('is_protected column does NOT exist or error:', colError.message);
  } else {
    console.log('is_protected column EXISTS');
  }
}

checkSchema();
