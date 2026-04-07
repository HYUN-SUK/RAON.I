import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Load Env
const env = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const KAKAO_KEY = env.KAKAO_REST_API_KEY;

async function finalize() {
    const newAddress = '충청남도 예산군 응봉면 응봉서로 280';
    console.log(`🔍 Geocoding new address: ${newAddress}`);

    try {
        // 1. Geocode
        const geoRes = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(newAddress)}`, {
            headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` }
        }).then(r => r.json());

        if (geoRes.documents?.[0]) {
            const { x, y } = geoRes.documents[0];
            const lat = parseFloat(y);
            const lng = parseFloat(x);
            console.log(`✅ New Coords: ${lat}, ${lng}`);

            // 2. Update master_places
            const { error: mErr } = await supabase.from('master_places')
                .update({ address: newAddress, lat, lng })
                .ilike('name', '%라온아이%');
            
            if (mErr) throw mErr;
            console.log('🚀 master_places updated for Raon AI.');

            // 3. Update user_schedules (To keep historical data consistent)
            const { error: sErr } = await supabase.from('user_schedules')
                .update({ campground_address: newAddress, campground_lat: lat, campground_lng: lng })
                .ilike('campground_name', '%라온아이%');
            
            if (sErr) console.log('⚠️ user_schedules update skipped or no match.');
            else console.log('🚀 user_schedules location synced.');

        } else {
            throw new Error('Geocoding failed.');
        }
    } catch (e) {
        console.error('❌ Error during final update:', e.message);
    }
}

finalize();
