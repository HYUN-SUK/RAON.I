import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const SAFE_KEY = process.env.SAFE_RESTAURANT_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !KAKAO_KEY || !SAFE_KEY) {
    console.error('Missing env vars:', { SUPABASE_URL: !!SUPABASE_URL, SUPABASE_KEY: !!SUPABASE_KEY, KAKAO_KEY: !!KAKAO_KEY, SAFE_KEY: !!SAFE_KEY });
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function syncSafeRestaurant() {
    console.log('\n=== [DEBUG V2] 안심식당 (농림축산부) ===');
    const start = 1, end = 10;
    const url = `http://211.237.50.150:7080/openapi/${SAFE_KEY}/json/Grid_20200713000000000605_1/${start}/${end}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        const items = data.Grid_20200713000000000605_1?.row || [];
        console.log('Items fetched from Public API:', items.length);

        const chunk = [];
        for (const item of items) {
            const addr = item.RELAX_ADD1 || '';
            const name = item.RELAX_REST_NM || '';
            if (!addr || !name) continue;

            // Geocode
            try {
                const kRes = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(addr)}`, {
                    headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` }
                });
                const kData = await kRes.json();
                if (kData.documents && kData.documents.length > 0) {
                    const lat = parseFloat(kData.documents[0].y);
                    const lng = parseFloat(kData.documents[0].x);
                    chunk.push({
                        id: crypto.randomUUID(), api_source: 'SAFE_RESTAURANT', category: 'RESTAURANT',
                        name, description: '농식품부 인증 위생 안심식당 (DEBUG)', address: addr,
                        lat, lng, trust_score: 50, raw_data: item
                    });
                    console.log(`✅ [${name}] Geocoded.`);
                } else {
                    console.log(`❌ [${name}] Geocode Failed (No result).`);
                }
            } catch (ee) {
                console.error(`💥 [${name}] Geocode Error:`, ee.message);
            }
        }

        console.log('Chunk size to insert:', chunk.length);
        if (chunk.length > 0) {
            const { error } = await supabase.from('master_places').insert(chunk);
            if (error) {
                console.error('Insert Error:', error.message);
                if (error.details) console.error('Details:', error.details);
            } else {
                console.log('Successfully inserted debug items.');
            }
        }
    } catch (e) {
        console.error('Fatal Error In Debug:', e.message);
    }
}
syncSafeRestaurant();
