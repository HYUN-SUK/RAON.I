#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const SAFE_KEY = process.env.SAFE_RESTAURANT_API_KEY;
const OPINET_KEY = process.env.OPINET_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !PUBLIC_API_KEY) {
    console.error('Missing required env vars: SUPABASE_URL, SUPABASE_KEY, PUBLIC_DATA_API_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const fetchOptions = { headers: { 'User-Agent': 'Mozilla/5.0' } };

// 전역 상태
let totalInserted = 0;
let totalSkipped = 0;
const geocodeCache = new Map();

// ========================================================================================
// 유틸리티
// ========================================================================================

async function loadExistingAddresses() {
    console.log('[DEDUP] Loading existing addresses from master_places...');
    let offset = 0;
    while (true) {
        const { data, error } = await supabase
            .from('master_places')
            .select('address, lat, lng')
            .not('lat', 'is', null)
            .range(offset, offset + 1000 - 1);
        if (error || !data || data.length === 0) break;
        for (const row of data) {
            if (row.address && row.lat && row.lng) geocodeCache.set(row.address, { lat: row.lat, lng: row.lng });
        }
        offset += 1000;
        if (data.length < 1000) break;
    }
    console.log(`[DEDUP] Cached ${geocodeCache.size} addresses.`);
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
        await new Promise(r => setTimeout(r, 20)); // Rate limit protection
    }
    return results;
}

async function upsertBatch(table, items) {
    if (items.length === 0) return 0;
    const addresses = items.map(i => i.address);
    const { data: existing } = await supabase.from(table).select('name, address').in('address', addresses);
    const existingSet = new Set((existing || []).map(e => `${e.name}|${e.address}`));
    const newItems = items.filter(i => !existingSet.has(`${i.name}|${i.address}`));
    totalSkipped += (items.length - newItems.length);
    if (newItems.length === 0) return 0;
    const { error } = await supabase.from(table).insert(newItems);
    if (error) { console.error(`  → DB Error: ${error.message}`); return 0; }
    totalInserted += newItems.length;
    return newItems.length;
}

// ========================================================================================
// 수집 함수들
// ========================================================================================

async function syncTour(contentTypeId, apiSource, label, category) {
    console.log(`\n=== [ETL] ${label} (TourAPI) ===`);
    let pageNo = 1, hasMore = true;
    while (hasMore && pageNo <= 300) {
        try {
            const res = await fetch(`http://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${PUBLIC_API_KEY}&numOfRows=100&pageNo=${pageNo}&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=${contentTypeId}`, fetchOptions);
            const data = await res.json();
            const items = data.response?.body?.items?.item;
            if (!items) { hasMore = false; break; }
            const itemList = (Array.isArray(items) ? items : [items]).filter(i => !isNaN(parseFloat(i.mapy)));
            const chunk = itemList.map(i => ({
                id: crypto.randomUUID(), api_source: apiSource, category,
                name: i.title, description: `한국관광공사 등록 ${label}`, address: i.addr1 || i.addr2 || '',
                lat: parseFloat(i.mapy), lng: parseFloat(i.mapx), trust_score: 40, raw_data: i
            }));
            await upsertBatch('master_places', chunk);
            pageNo++;
            if (itemList.length < 100) hasMore = false;
        } catch (e) { console.error(`  ${apiSource} Error:`, e.message); hasMore = false; }
    }
}

async function syncMois(url, apiSource, label, category, desc) {
    console.log(`\n=== [ETL] ${label} (행안부) ===`);
    let pageNo = 1, hasMore = true;
    while (hasMore && pageNo <= 100) {
        try {
            const res = await fetch(`${url}&serviceKey=${PUBLIC_API_KEY}&pageNo=${pageNo}&numOfRows=100&type=json`, fetchOptions);
            const data = await res.json();
            const items = data.body?.items?.item;
            if (!items) { hasMore = false; break; }
            const itemList = Array.isArray(items) ? items : [items];
            console.log(`  Page ${pageNo}: Processing ${itemList.length} items...`);
            const geocoded = await processInParallel(itemList, 10, async (i) => {
                const name = i.BPLC_NM || i.bplcNm || '';
                const addr = i.RDNWH_ADDR || i.SITE_WHL_ADDR || '';
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

async function syncSafeRestaurant() {
    console.log('\n=== [ETL] 안심식당 (농림축산부) ===');
    if (!SAFE_KEY) return;
    let pageNo = 1, hasMore = true;
    while (hasMore && pageNo <= 100) {
        try {
            const start = (pageNo - 1) * 1000 + 1, end = pageNo * 1000;
            const res = await fetch(`http://211.237.50.150:7080/openapi/${SAFE_KEY}/json/Grid_20200713000000000605_1/${start}/${end}`);
            const data = await res.json();
            const items = data.Grid_20200713000000000605_1?.row;
            if (!items || items.length === 0) { hasMore = false; break; }
            console.log(`  Page ${pageNo}: Processing ${items.length} items...`);
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
        } catch (e) { console.error('  SafeRest Error:', e.message); hasMore = false; }
    }
}

async function main() {
    const startTime = Date.now();
    await loadExistingAddresses();
    await syncTour(12, 'TOUR_SPOT', '관광명소', 'SPOT');
    await syncTour(39, 'TOUR_CAFE', '카페', 'RESTAURANT');
    await syncMois(`http://apis.data.go.kr/B552061/goodRestaurant/getGoodRestaurantList?`, 'MOIS_GOOD_RESTAURANT', '모범음식점', 'RESTAURANT', '행정안전부 지정 모범음식점');
    await syncMois(`http://apis.data.go.kr/B552061/largeStore/getLargeStoreList?`, 'LARGE_STORE', '대형마트', 'MART', '대형마트/백화점 (행안부 등록)');
    await syncSafeRestaurant();

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n🏁 COMPLETE in ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
    console.log(`Inserted: ${totalInserted}, Skipped: ${totalSkipped}`);
}

main().catch(console.error);
