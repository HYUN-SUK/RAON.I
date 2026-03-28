
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('--- Yesan Region Data Check ---');
  // 1. Direct query master_places near Yesan
  const { data: near } = await supabase.from('master_places')
    .select('name, address, lat, lng')
    .ilike('address', '%예산군%')
    .limit(5);
  
  if (near) {
    console.log(`Found ${near.length} items in Yesan-gun (text search).`);
    near.forEach(i => console.log(` - ${i.name} (${i.lat}, ${i.lng}) | ${i.address}`));
  }

  // 2. Check if campground "철수네" exists and its coords
  const { data: schedule } = await supabase.from('user_schedules')
    .select('*')
    .eq('campground_name', '철수네')
    .eq('check_in', '2026-03-31')
    .single();

  if (schedule) {
    console.log('Target Campground:', schedule.campground_name, 'Coords:', schedule.campground_lat, schedule.campground_lng);
  } else {
    console.log('Campground "철수네" (3/31) not found in schedules!');
  }
}
check();
