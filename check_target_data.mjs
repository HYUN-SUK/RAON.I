
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const target = '2026-03-20';
  const { data, count } = await supabase
    .from('user_schedules')
    .select('*', { count: 'exact' })
    .eq('check_in', target);
  
  console.log(`Found ${count} records for check_in = ${target}`);
  if (data && data.length > 0) {
    console.log('Sample record:', {
      id: data[0].id,
      name: data[0].campground_name,
      lat: data[0].campground_lat,
      lng: data[0].campground_lng,
      check_in: data[0].check_in
    });
  }
}
check();
