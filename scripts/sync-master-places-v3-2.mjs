#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
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
    }
    return results;
}

// 3. 안정적인 적재 (Fail-safe insert)
async function dbStore(table, items) {
    if (items.length === 0) return 0;

    // 1. Bulk insert 시도 (가장 빠름)
    const { error } = await supabase.from(table).insert(items);

    if (error) {
        // 2. 벌크 실패 시 개별 삽입으로 안전하게 진행 (중복 건만 실패하고 나머지는 들어감)
        let successCount = 0;
        for (const item of items) {
            const { error: singleError } = await supabase.from(table).insert(item);
            if (!singleError) {
                successCount++;
            }
        }
        totalInserted += successCount;
        return successCount;
    }

    totalInserted += items.length;
    return items.length;
}

// 안심식당 수집
async function syncSafeRestaurant() {
    console.log('\n=== [ETL 3.2] 안심식당 (농림축산부) ===');
    if (!SAFE_KEY) {
        console.error('  [!] No SAFE_RESTAURANT_API_KEY found');
        return;
    }
    let pageNo = 1, hasMore = true;
    while (hasMore && pageNo <= 100) { // 약 10만건 루프
        const start = (pageNo - 1) * 1000 + 1, end = pageNo * 1000;
        try {
            const res = await fetch(`http://211.237.50.150:7080/openapi/${SAFE_KEY}/json/Grid_20200713000000000605_1/${start}/${end}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const items = data.Grid_20200713000000000605_1?.row || [];
            if (items.length === 0) {
                console.log(`  [!] No more safe restaurants at page ${pageNo}`);
                hasMore = false; break;
            }

            console.log(`  Page ${pageNo}: Fetched ${items.length} items. Geocoding...`);
            const geocoded = await processInParallel(items, 30, async (i) => {
                // 실제 API 응답 필드 확인 결과: RELAX_RSTRNT_NM, RELAX_ADD1
                const name = i.RELAX_RSTRNT_NM || '';
                const addr = i.RELAX_ADD1 || '';

                if (!name || !addr) return null;

                const coords = await geocodeAddress(addr);
                if (!coords) return null;

                return {
                    api_source: 'SAFE_RESTAURANT',
                    category: 'RESTAURANT',
                    name,
                    description: '농식품부 인증 안심식당',
                    address: addr,
                    lat: coords.lat,
                    lng: coords.lng,
                    trust_score: 50,
                    raw_data: i
                };
            });
            console.log(`  Page ${pageNo}: Geocoding SUCCESS: ${geocoded.length}/${items.length}`);
            const storedCount = await dbStore('master_places', geocoded);
            console.log(`  Page ${pageNo}: Actually Stored ${storedCount}/${items.length} (Total Found: ${geocoded.length})`);
            pageNo++;
        } catch (e) { console.error('  Safe Error:', e.message); hasMore = false; }
    }
}

// 주유소 수집
async function syncOpinet() {
    console.log('\n=== [ETL 3.2] 주유소 (OPINET) ===');
    if (!OPINET_KEY) return;
    try {
        // 전국 주요 거점 중심 순차 수집 대신, 전국 코드 리스트가 필요할 수 있으나 
        // 현재는 특정 반경 10km 수집만 제공되므로 우선 가용한 곳 위주로 적재
        const res = await fetch(`http://www.opinet.co.kr/api/aroundAll.do?code=${OPINET_KEY}&x=175658&y=341695&radius=10000&sort=1&prodcd=C004&out=json`, fetchOptions);
        const data = await res.json();
        const items = data.RESULT?.OIL || [];
        console.log(`  Fetched ${items.length} gas stations...`);
        const geocoded = await processInParallel(items, 10, async (i) => {
            const addr = i.NEW_ADR || i.VAN_ADR || '', name = i.OS_NM || '';
            const coords = await geocodeAddress(addr);
            return coords ? {
                api_source: 'OPINET', category: 'GAS_STATION', name, description: '오피넷 등록 주유소', address: addr,
                lat: coords.lat, lng: coords.lng, trust_score: 95, raw_data: i
            } : null;
        });
        const storedCount = await dbStore('master_places_gas', geocoded);
        console.log(`  Gas Stations Stored: ${storedCount}/${items.length}`);
    } catch (e) { console.error('  Opinet Error:', e.message); }
}

async function main() {
    const startTime = Date.now();
    await loadExistingAddresses();
    await syncOpinet();
    await syncSafeRestaurant();
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n🏁 COMPLETE in ${Math.floor(elapsed / 60)}m ${elapsed % 60}s. Total Saved: ${totalInserted}`);
}

main().catch(console.error);
