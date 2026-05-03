import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function updateRaonAddressFull() {
    const address = '충청남도 예산군 응봉면 응봉서로 280';
    console.log(`🔍 Geocoding address: ${address}`);

    try {
        const res = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`, {
            headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` }
        }).then(r => r.json());

        if (res.documents?.[0]) {
            const { x, y } = res.documents[0];
            const lat = parseFloat(y);
            const lng = parseFloat(x);
            console.log(`✅ Coordinates found: ${lat}, ${lng}`);

            // 1. Update site_config
            const { error: err1 } = await supabase
                .from('site_config')
                .update({ 
                    address_main: address,
                    address_detail: ''
                })
                .eq('id', 1);
            if (err1) console.error('❌ site_config update error:', err1.message);
            else console.log('🚀 site_config updated.');

            // 2. Update master_places
            const { error: err2 } = await supabase
                .from('master_places')
                .update({ address, lat, lng })
                .ilike('name', '%라온아이%');
            if (err2) console.error('❌ master_places update error:', err2.message);
            else console.log('🚀 master_places updated.');

            // 3. Update campgrounds
            const { error: err3 } = await supabase
                .from('campgrounds')
                .update({ address, lat, lng })
                .ilike('name', '%라온아이%');
            if (err3) console.error('❌ campgrounds update error:', err3.message);
            else console.log('🚀 campgrounds updated.');

            console.log('✨ All location updates completed.');
        } else {
            console.error('❌ Could not find coordinates for the address.');
        }
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

updateRaonAddressFull();
