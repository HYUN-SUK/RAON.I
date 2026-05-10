
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkSchedules() {
    const { data: schedules } = await supabase.from('user_schedules')
        .select('*')
        .eq('check_in', '2026-05-12');
    
    console.log('--- Schedules for 2026-05-12 ---');
    schedules.forEach(s => {
        console.log(`- Name: ${s.campground_name}`);
        console.log(`  Addr: ${s.campground_address}`);
        console.log(`  Lat/Lng: ${s.campground_lat}, ${s.campground_lng}`);
    });
}

checkSchedules();
