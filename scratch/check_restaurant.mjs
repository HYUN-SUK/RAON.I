import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    console.log('--- Calling RPC get_master_places_in_radius_v2 ---');
    const { data, error } = await supabase.rpc('get_master_places_in_radius_v2', {
        target_lat: 36.6269,
        target_lng: 126.7648,
        radius_meters: 25000,
        p_category: 'RESTAURANT',
        limit_count: 3000
    });

    if (error) {
        console.error('RPC Error:', error);
        return;
    }

    console.log('--- Search Results ---');
    const bak = data.filter(x => x.name.includes('박속황태'));
    console.log('박속황태:', JSON.stringify(bak, null, 2));

    const hal = data.filter(x => x.name.includes('할머니') && x.name.includes('어죽'));
    console.log('할머니 어죽:', JSON.stringify(hal, null, 2));

    const allHal = data.filter(x => x.name.includes('할머니'));
    console.log('기타 할머니 식당 수:', allHal.length);
}

check();
