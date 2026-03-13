import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const SAFE_KEY = process.env.SAFE_RESTAURANT_API_KEY;

async function geocodeAddress(address) {
    if (!KAKAO_KEY || !address) return null;
    try {
        const res = await fetch(
            `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
            { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } }
        );
        const data = await res.json();
        if (data.documents && data.documents.length > 0) {
            return { lat: parseFloat(data.documents[0].y), lng: parseFloat(data.documents[0].x) };
        }
        return null;
    } catch (e) {
        console.error('Geocode Error:', e.message);
        return null;
    }
}

async function debugSync() {
    console.log('--- Debugging Safe Restaurant Sync ---');
    const start = 1, end = 10;
    const url = `http://211.237.50.150:7080/openapi/${SAFE_KEY}/json/Grid_20200713000000000605_1/${start}/${end}`;

    const res = await fetch(url);
    const data = await res.json();
    const items = data.Grid_20200713000000000605_1?.row || [];

    console.log(`Fetched ${items.length} items.`);

    for (const item of items) {
        const addr = item.RELAX_ADD1 || '';
        const name = item.RELAX_REST_NM;
        console.log(`Checking: [${name}] Address: [${addr}]`);
        const coords = await geocodeAddress(addr);
        if (coords) {
            console.log(`✅ Success: ${coords.lat}, ${coords.lng}`);
        } else {
            console.warn(`❌ Failed to geocode address: ${addr}`);
        }
    }
}

debugSync();
