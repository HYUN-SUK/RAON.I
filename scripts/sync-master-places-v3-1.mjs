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

// 1. 기존 주소 캐싱 (카카오 API 과금 방지)
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

// 2. 고속 지오코딩
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
        await new Promise(r => setTimeout(r, 50));
    }
    return results;
}

// 3. 안정적인 적재 (Constraint 이슈 대비)
async function upsertBatch(table, items) {
    if (items.length === 0) return 0;

    // Supabase의 기본 insert는 중복 시 에러를 반환하므로, 개별 시도 혹은 벌크 insert 후 에러 핸들링
    const { error } = await supabase.from(table).insert(items);

    if (error) {
        console.log(`    [DB] Bulk insert issue (${error.message}). Switching to individual mode for ${items.length} items...`);
        let successCount = 0;
        for (const item of items) {
            const { error: singleError } = await supabase.from(table).insert(item);
            if (!singleError) {
                successCount++;
            } else if (!singleError.message.includes('unique_name_address')) {
                // 중복 에러 외의 다른 에러는 출력
                console.error(`      [DB] Insert failed for ${item.name}: ${singleError.message}`);
            }
        }
        totalInserted += successCount;
        return successCount;
    }

    console.log(`    [DB] Bulk success: ${items.length} records.`);
    totalInserted += items.length;
    return items.length;
}

// ========================================================================================
// 수집 함수: 행안부 (Unexpected Errors 대응)
// ========================================================================================
async function syncMoisCategory(url, apiSource, label, category, desc) {
    console.log(`\n=== [ETL 3.1] ${label} (행안부) ===`);
    let pageNo = 1, hasMore = true, consecutiveErrors = 0;

    while (hasMore && pageNo <= 200) {
        try {
            // URL 파라미터 구성 (공공데이터포털 표준)
            const finalUrl = `${url}serviceKey=${PUBLIC_API_KEY}&pageNo=${pageNo}&numOfRows=100&type=json`;
            const res = await fetch(finalUrl, fetchOptions);
            const text = await res.text();

            if (text.includes('Unexpected errors')) {
                console.warn(`  [!] Page ${pageNo}: MOIS API Return 'Unexpected errors'.`);
                consecutiveErrors++;
                if (consecutiveErrors > 3) { console.error('  [!!] Too many errors, skip category.'); break; }
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }

            let data;
            try { data = JSON.parse(text); } catch (e) {
                console.error(`  [!] JSON Parse Error on page ${pageNo}`);
                hasMore = false; break;
            }

            const items = data.body?.items?.item || data.response?.body?.items?.item;
            if (!items) {
                console.log(`  [!] No more items found at page ${pageNo}`);
                hasMore = false; break;
            }
            const itemList = (Array.isArray(items) ? items : [items]).filter(i => (i.BPLC_NM || i.bplcNm) && (i.RDNWH_ADDR || i.SITE_WHL_ADDR));

            console.log(`  Page ${pageNo}: Fetched ${itemList.length} items. Geocoding...`);
            const geocoded = await processInParallel(itemList, 10, async (i) => {
                const name = i.BPLC_NM || i.bplcNm || '', addr = i.RDNWH_ADDR || i.SITE_WHL_ADDR || '';
                const coords = await geocodeAddress(addr);
                return coords ? {
                    api_source: apiSource, category, name, description: desc, address: addr,
                    lat: coords.lat, lng: coords.lng, trust_score: 55, raw_data: i
                } : null;
            });
            const stored = await upsertBatch('master_places', geocoded);
            console.log(`  Page ${pageNo}: Geocoded and stored ${stored}/${itemList.length} items.`);
            pageNo++;
            consecutiveErrors = 0;
            if (itemList.length < 100) hasMore = false;
        } catch (e) {
            console.error(`  ${apiSource} Fatal Exception:`, e.message);
            hasMore = false;
        }
    }
}

// ========================================================================================
// 수집 함수: 안심식당 (최대 10만건 루프)
// ========================================================================================
async function syncSafeRestaurant() {
    console.log('\n=== [ETL 3.1] 안심식당 (농림축산부) ===');
    if (!SAFE_KEY) {
        console.error('  [!] No SAFE_RESTAURANT_API_KEY found');
        return;
    }
    let pageNo = 1, hasMore = true;
    while (hasMore && pageNo <= 100) {
        const start = (pageNo - 1) * 1000 + 1, end = pageNo * 1000;
        try {
            const res = await fetch(`http://211.237.50.150:7080/openapi/${SAFE_KEY}/json/Grid_20200713000000000605_1/${start}/${end}`);
            const data = await res.json();
            const items = data.Grid_20200713000000000605_1?.row || [];
            if (items.length === 0) {
                console.log(`  [!] No more safe restaurants at page ${pageNo}`);
                hasMore = false; break;
            }

            console.log(`  Page ${pageNo}: Fetched ${items.length} items. Geocoding...`);
            const geocoded = await processInParallel(items, 20, async (i) => {
                const addr = i.RELAX_ADD1 || '', name = i.RELAX_REST_NM || '';
                if (!addr || !name) return null;
                const coords = await geocodeAddress(addr);
                return coords ? {
                    api_source: 'SAFE_RESTAURANT', category: 'RESTAURANT', name, description: '농식품부 인증 안심식당', address: addr,
                    lat: coords.lat, lng: coords.lng, trust_score: 50, raw_data: i
                } : null;
            });
            const stored = await upsertBatch('master_places', geocoded);
            console.log(`  Page ${pageNo}: Geocoded and stored ${stored}/${items.length} items.`);
            pageNo++;
        } catch (e) { console.error('  Safe Error:', e.message); hasMore = false; }
    }
}

// ========================================================================================
// 수집 함수: 주유소 (OPINET)
// ========================================================================================
async function syncOpinet() {
    console.log('\n=== [ETL 3.1] 주유소 (OPINET) ===');
    if (!OPINET_KEY) return;
    try {
        const res = await fetch(`http://www.opinet.co.kr/api/aroundAll.do?code=${OPINET_KEY}&x=175658&y=341695&radius=10000&sort=1&prodcd=C004&out=json`, fetchOptions);
        const data = await res.json();
        const items = data.RESULT?.OIL || [];
        console.log(`  Processing ${items.length} gas stations...`);
        const geocoded = await processInParallel(items, 10, async (i) => {
            const addr = i.NEW_ADR || i.VAN_ADR || '', name = i.OS_NM || '';
            const coords = await geocodeAddress(addr);
            return coords ? {
                api_source: 'OPINET', category: 'GAS_STATION', name, description: '겨울철 난방 실내등유 주유소', address: addr,
                lat: coords.lat, lng: coords.lng, trust_score: 95, raw_data: i
            } : null;
        });
        await upsertBatch('master_places_gas', geocoded);
    } catch (e) { console.error('  Opinet Error:', e.message); }
}

async function main() {
    console.log('🚀 ETL 3.1: Full Recovery Mode Start');
    const startTime = Date.now();

    await loadExistingAddresses();

    // 1. 주유소
    await syncOpinet();

    // 2. 행안부 계열
    await syncMoisCategory('http://apis.data.go.kr/B552061/goodRestaurant/getGoodRestaurantList?', 'MOIS_GOOD_RESTAURANT', '모범음식점', 'RESTAURANT', '행정안전부 지정 모범음식점');
    await syncMoisCategory('http://apis.data.go.kr/B552061/largeStore/getLargeStoreList?', 'LARGE_STORE', '대형마트', 'MART', '대형마트/백화점 (행안부 등록)');

    // 3. 안심식당 (대용량)
    await syncSafeRestaurant();

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n🏁 COMPLETE in ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
    console.log(`Total Recovery Inserted: ${totalInserted}`);
}

main().catch(console.error);
