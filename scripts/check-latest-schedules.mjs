import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
    try {
        const { data, error } = await supabase
            .from('user_schedules')
            .select('check_in, campground_name')
            .order('check_in', { ascending: false })
            .limit(10);
        
        if (error) {
            console.error('❌ Supabase Error:', error);
            return;
        }
        
        console.log('--- [Recent Reservations] ---');
        data.forEach(s => {
            console.log(`📅 ${s.check_in} | 🏕️ ${s.campground_name}`);
            console.log(`   📍 Coord: ${s.campground_lat}, ${s.campground_lng}`);
            console.log(`   🏠 Addr: ${s.campground_address}`);
            console.log('---');
        });
    } catch (e) {
        console.error('❌ Fatal Error:', e.message);
    }
}
check();
