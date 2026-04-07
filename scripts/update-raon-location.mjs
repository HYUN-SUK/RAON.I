import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function updateRaonAddress() {
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

            const { error } = await supabase
                .from('master_places')
                .update({ address, lat, lng })
                .ilike('name', '%라온아이%');

            if (error) throw error;
            console.log('🚀 master_places updated successfully.');
        } else {
            console.error('❌ Could not find coordinates for the address.');
        }
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

updateRaonAddress();
