import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function geocodeFallback() {
    console.log('🔍 Checking for SSM records without coordinates...');
    
    const { data: missing, error } = await supabase
        .from('master_places')
        .select('id, name, address')
        .eq('api_source', 'LOCALDATA_MART_SSM')
        .or('lat.is.null,lng.is.null');

    if (error) {
        console.error('Fetch error:', error.message);
        return;
    }

    console.log(`- Found ${missing.length} records needing geocoding.`);
    if (missing.length === 0) return;

    for (let i = 0; i < missing.length; i++) {
        const item = missing[i];
        try {
            const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(item.address)}`;
            const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_KEY}` } });
            const result = await res.json();

            if (result.documents && result.documents.length > 0) {
                const { x, y } = result.documents[0];
                const { error: upErr } = await supabase
                    .from('master_places')
                    .update({ lat: parseFloat(y), lng: parseFloat(x), trust_score: 80 })
                    .eq('id', item.id);
                
                if (upErr) console.error(`  - Update Error for ${item.name}:`, upErr.message);
                else process.stdout.write(`\r  - Progress: ${i+1}/${missing.length} enriched ✅`);
            } else {
                // Try keyword search if address fails
                const kwUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(item.name)}`;
                const kwRes = await fetch(kwUrl, { headers: { Authorization: `KakaoAK ${KAKAO_KEY}` } });
                const kwResult = await kwRes.json();
                if (kwResult.documents && kwResult.documents.length > 0) {
                    const { x, y } = kwResult.documents[0];
                    await supabase.from('master_places').update({ lat: parseFloat(y), lng: parseFloat(x), trust_score: 75 }).eq('id', item.id);
                    process.stdout.write(`\r  - Progress: ${i+1}/${missing.length} enriched (keyword) ✅`);
                }
            }
        } catch (e) {
            console.error(`\n  - Geocoding failed for ${item.name}:`, e.message);
        }
    }
    console.log('\n🏁 Geocoding fallback complete.');
}

geocodeFallback();
