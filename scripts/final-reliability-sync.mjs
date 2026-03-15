#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { v5 as uuidv5 } from 'uuid';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_KEY = process.env.PUBLIC_DATA_API_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function generateId(source, name, addr) {
    return uuidv5(`${source}|${String(name).trim()}|${String(addr).trim()}`, MY_NAMESPACE);
}

async function geocodeAddress(address) {
    if (!KAKAO_KEY || !address) return null;
    try {
        const res = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`, {
            headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` }
        });
        const data = await res.json();
        if (data.documents?.length > 0) {
            return { lat: parseFloat(data.documents[0].y), lng: parseFloat(data.documents[0].x) };
        }
        return null;
    } catch { return null; }
}

async function syncRegion(regionKeyword) {
    console.log(`🚀 [START] Multi-Source Sync for region: ${regionKeyword}`);
    
    // [1] Baeknyeon
    console.log('  -> Syncing Baeknyeon...');
    const spec = await fetch(`https://infuser.odcloud.kr/oas/docs?namespace=${encodeURIComponent('15102255/v1')}`).then(r => r.json());
    const bPath = Object.keys(spec.paths || {})[0];
    const bData = await fetch(`https://api.odcloud.kr/api${bPath}?page=1&perPage=500&serviceKey=${PUBLIC_KEY}`).then(r => r.json());
    const bItems = (bData.data || []).filter(i => (i['주소'] || '').includes(regionKeyword));
    
    for (const i of bItems) {
        const name = i['업체명'], addr = i['주소'];
        const coords = await geocodeAddress(addr);
        if (coords) {
            await supabase.from('master_places').upsert({
                id: generateId('SMBA_BAEK', name, addr), api_source: 'SMBA_BAEK', category: 'RESTAURANT',
                name, address: addr, lat: coords.lat, lng: coords.lng, trust_score: 80, raw_data: i
            }, { onConflict: 'id' });
        }
    }
    console.log(`  [Done] Baeknyeon: ${bItems.length} checked.`);

    // [2] Good Restaurant
    console.log('  -> Syncing Good Restaurant...');
    const gData = await fetch(`http://apis.data.go.kr/B552061/goodRestaurant/getGoodRestaurantList?serviceKey=${PUBLIC_KEY}&pageNo=1&numOfRows=1000&type=json`).then(r => r.json());
    const gItems = (gData.body?.items?.item || []).filter(i => (i.rdnWhlAddr || i.siteWhlAddr || '').includes(regionKeyword));
    
    for (const i of gItems) {
        const name = i.bplcNm, addr = i.rdnWhlAddr || i.siteWhlAddr;
        const coords = await geocodeAddress(addr);
        if (coords) {
            await supabase.from('master_places').upsert({
                id: generateId('MOIS_GOOD_RESTAURANT', name, addr), api_source: 'MOIS_GOOD_RESTAURANT', category: 'RESTAURANT',
                name, address: addr, lat: coords.lat, lng: coords.lng, trust_score: 65, raw_data: i
            }, { onConflict: 'id' });
        }
    }
    console.log(`  [Done] Good Restaurant: ${gItems.length} checked.`);

    console.log('🏁 Region Sync Finished.');
}

// 강릉 지역 집중 수집 (중복 가능성 높음)
syncRegion('강릉');
