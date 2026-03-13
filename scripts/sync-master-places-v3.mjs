#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const SAFE_KEY = process.env.SAFE_RESTAURANT_API_KEY;
const OPINET_KEY = process.env.OPINET_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !PUBLIC_API_KEY) {
    console.error('Missing required env vars');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const fetchOptions = { headers: { 'User-Agent': 'Mozilla/5.0' } };
const geocodeCache = new Map();
let totalInserted = 0;

async function loadExistingAddresses() {
    console.log('[CACHE] Loading existing addresses...');
    let offset = 0;
    while (true) {
        const { data, error } = await supabase.from('master_places').select('address, lat, lng').not('lat', 'is', null).range(offset, offset + 1000 - 1);
        if (error || !data || data.length === 0) break;
        data.forEach(r => geocodeCache.set(r.address, { lat: r.lat, lng: r.lng }));
        offset += 1000;
        if (data.length < 1000) break;
    }
    console.log(`[CACHE] Total: ${geocodeCache.size}`);
}

async function geocodeAddress(address) {
    if (!KAKAO_KEY || !address) return null;
    if (geocodeCache.has(address)) return geocodeCache.get(address);
    try {
        const res = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`, {
            headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` }
        });
        const data = await res.json();
        if (data.documents?.length > 0) {
            const coords = { lat: parseFloat(data.documents[0].y), lng: parseFloat(data.documents[0].x) };
            geocodeCache.set(address, coords); return coords;
        }
        return null;
    } catch { return null; }
}

async function processInParallel(items, concurrency, processor) {
    const results = [];
    for (let i = 0; i < items.length; i += concurrency) {
        const chunk = items.slice(i, i + concurrency);
        const chunkResults = await Promise.all(chunk.map(item => processor(item)));
        results.push(...chunkResults.filter(r => r !== null));
        await new Promise(r => setTimeout(r, 20));
    }
    return results;
}

async function upsertBatch(table, items) {
    if (items.length === 0) return 0;
    const { error } = await supabase.from(table).upsert(items, { onConflict: 'name, address' });
    if (error) { console.error(`  → Error: ${error.message}`); return 0; }
    totalInserted += items.length;
    return items.length;
}

// ----------------------------------------------------------------------------------------
// [SBA] 백년가게 (Discovery Logic)
// ----------------------------------------------------------------------------------------
async function syncSmbaBacknyon() {
    console.log('\n=== [SMBA] 백년가게 (SBA) ===');
    try {
        const specRes = await fetch(`https://infuser.odcloud.kr/oas/docs?namespace=${encodeURIComponent('15102255/v1')}`, fetchOptions);
        const spec = await specRes.json();
        const path = Object.keys(spec.paths || {})[0];
        if (!path) return;

        let pageNo = 1, hasMore = true;
        while (hasMore && pageNo <= 100) {
            const res = await fetch(`https://api.odcloud.kr/api${path}?serviceKey=${PUBLIC_API_KEY}&page=${pageNo}&perPage=100`, fetchOptions);
            const data = await res.json();
            const items = data.data || [];
            if (items.length === 0) { hasMore = false; break; }

            const geocoded = await processInParallel(items, 10, async (i) => {
                const addr = i['주소'] || '', name = i['업체명'] || '';
                if (!addr || !name) return null;
                const coords = await geocodeAddress(addr);
                return coords ? {
                    id: crypto.randomUUID(), api_source: 'SMBA_BAEK', category: 'RESTAURANT',
                    name, description: `백년가게 공식 지정 (${i['업종'] || '식당'})`, address: addr,
                    lat: coords.lat, lng: coords.lng, trust_score: 80, raw_data: i
                } : null;
            });
            await upsertBatch('master_places', geocoded);
            pageNo++;
            if (items.length < 100) hasMore = false;
        }
    } catch (e) { console.error('  SMBA Error:', e.message); }
}

// ----------------------------------------------------------------------------------------
// [MOIS] 모범음식점, 대규모점포 (Robust Logic)
// ----------------------------------------------------------------------------------------
async function syncMoisCategory(url, apiSource, label, category, desc) {
    console.log(`\n=== [MOIS] ${label} ===`);
    let pageNo = 1, hasMore = true;
    while (hasMore && pageNo <= 100) {
        try {
            // MOIS API는 에러가 잦으므로 타입별로 시도
            const finalUrl = `${url}&serviceKey=${PUBLIC_API_KEY}&pageNo=${pageNo}&numOfRows=100&type=json`;
            const res = await fetch(finalUrl, fetchOptions);
            const text = await res.text();
            let data;
            try { data = JSON.parse(text); } catch {
                console.log(`  Page ${pageNo}: MOIS API Offline/Error (Unexpected errors)`);
                hasMore = false; break;
            }

            const items = data.body?.items?.item || data.response?.body?.items?.item;
            if (!items) { hasMore = false; break; }
            const itemList = Array.isArray(items) ? items : [items];

            const geocoded = await processInParallel(itemList, 10, async (i) => {
                const name = i.BPLC_NM || i.bplcNm || '', addr = i.RDNWH_ADDR || i.SITE_WHL_ADDR || '';
                if (!addr || !name) return null;
                const coords = await geocodeAddress(addr);
                return coords ? {
                    id: crypto.randomUUID(), api_source: apiSource, category,
                    name, description: desc, address: addr,
                    lat: coords.lat, lng: coords.lng, trust_score: 55, raw_data: i
                } : null;
            });
            await upsertBatch('master_places', geocoded);
            pageNo++;
            if (itemList.length < 100) hasMore = false;
        } catch (e) { console.error(`  ${apiSource} Error:`, e.message); hasMore = false; }
    }
}

// ----------------------------------------------------------------------------------------
// [SAFE] 안심식당 (Direct Logic)
// ----------------------------------------------------------------------------------------
async function syncSafeRestaurant() {
    console.log('\n=== [SAFE] 안심식당 ===');
    if (!SAFE_KEY) return;
    let pageNo = 1, hasMore = true;
    while (hasMore && pageNo <= 200) { // Limit to 200 pages (200,000 items) or until done
        const start = (pageNo - 1) * 1000 + 1, end = pageNo * 1000;
        try {
            const res = await fetch(`http://211.237.50.150:7080/openapi/${SAFE_KEY}/json/Grid_20200713000000000605_1/${start}/${end}`);
            const data = await res.json();
            const items = data.Grid_20200713000000000605_1?.row || [];
            if (items.length === 0) { hasMore = false; break; }

            const geocoded = await processInParallel(items, 15, async (i) => {
                const addr = i.RELAX_ADD1 || '', name = i.RELAX_REST_NM || '';
                if (!addr || !name) return null;
                const coords = await geocodeAddress(addr);
                return coords ? {
                    id: crypto.randomUUID(), api_source: 'SAFE_RESTAURANT', category: 'RESTAURANT',
                    name, description: '농식품부 인증 안심식당', address: addr,
                    lat: coords.lat, lng: coords.lng, trust_score: 50, raw_data: i
                } : null;
            });
            await upsertBatch('master_places', geocoded);
            pageNo++;
            if (items.length < 1000) hasMore = false;
        } catch (e) { console.error('  Safe Error:', e.message); hasMore = false; }
    }
}

// ----------------------------------------------------------------------------------------
// [OPINET] 주유소
// ----------------------------------------------------------------------------------------
async function syncOpinet() {
    console.log('\n=== [OPINET] 주유소 ===');
    if (!OPINET_KEY) return;
    try {
        // Radius based collection (Approx center of Korea) or iterative
        const res = await fetch(`http://www.opinet.co.kr/api/aroundAll.do?code=${OPINET_KEY}&x=175658&y=341695&radius=10000&sort=1&prodcd=C004&out=json`, fetchOptions);
        const data = await res.json();
        const items = data.RESULT?.OIL || [];
        const geocoded = await processInParallel(items, 5, async (i) => {
            const addr = i.NEW_ADR || i.VAN_ADR || '', name = i.OS_NM || '';
            const coords = await geocodeAddress(addr);
            return coords ? {
                id: crypto.randomUUID(), api_source: 'OPINET', category: 'GAS_STATION',
                name, description: '겨울철 난방 실내등유 주유소', address: addr,
                lat: coords.lat, lng: coords.lng, trust_score: 95, raw_data: i
            } : null;
        });
        await upsertBatch('master_places_gas', geocoded);
    } catch (e) { console.error('  Opinet Error:', e.message); }
}

async function main() {
    console.log('--- ETL 3.0: Missing Data Recovery ---');
    await loadExistingAddresses();

    await syncSmbaBacknyon();
    await syncMoisCategory('http://apis.data.go.kr/B552061/goodRestaurant/getGoodRestaurantList?', 'MOIS_GOOD_RESTAURANT', '모범음식점', 'RESTAURANT', '행정안전부 지정 모범음식점');
    await syncMoisCategory('http://apis.data.go.kr/B552061/largeStore/getLargeStoreList?', 'LARGE_STORE', '대형마트', 'MART', '대형마트/백화점 (행안부 등록)');
    await syncSafeRestaurant();
    await syncOpinet();

    console.log(`\n🏁 Recovery Done. Inserted: ${totalInserted}`);
}

main().catch(console.error);
