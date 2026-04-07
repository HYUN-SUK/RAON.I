import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debug() {
    console.log('--- [Simulation Target Debugging] ---');
    
    // 1. Check reservation for 2026-04-08
    const { data: schedules } = await supabase
        .from('user_schedules')
        .select('*')
        .eq('check_in', '2026-04-08');
    
    console.log(`\n1. Reservations found for 2026-04-08: ${schedules?.length || 0}`);
    schedules?.forEach(s => {
        console.log(`   - Name: ${s.campground_name} | Lat: ${s.campground_lat} | Lng: ${s.campground_lng} | Addr: ${s.campground_address}`);
    });

    // 2. Search for Raon AI in master_places
    const { data: masters } = await supabase
        .from('master_places')
        .select('name, address, lat, lng')
        .ilike('name', '%라온%');
    
    console.log(`\n2. 'Raon' entries in master_places: ${masters?.length || 0}`);
    masters?.forEach(m => {
        console.log(`   - Master Name: ${m.name} | Lat: ${m.lat} | Lng: ${m.lng} | Addr: ${m.address}`);
    });

    // 3. Check for exact match "라온아이오토캠핑장"
    const raonMaster = masters?.find(m => m.name.includes('라온아이오토캠핑장'));
    if (raonMaster) {
        console.log(`\n✅ Found target master location: ${raonMaster.name} (${raonMaster.lat}, ${raonMaster.lng})`);
    } else {
        console.log(`\n❌ Could not find exact master entry for '라온아이오토캠핑장'`);
    }
}

debug();
