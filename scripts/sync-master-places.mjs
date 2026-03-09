#!/usr/bin/env node
// ========================================================================================
// scripts/sync-master-places.mjs
// Phase 11: 주간 풀-페이지네이션 동기화 (GitHub Actions Runner 직접 실행)
//
// - Vercel 5분 제한 없음 (GitHub Actions: 최대 6시간)
// - 지오코딩 중복 스킵: DB에 이미 존재하는 주소는 카카오 API 호출 안 함
// - Upsert: 이미 있는 데이터는 업데이트, 없으면 삽입
// ========================================================================================

import { createClient } from '@supabase/supabase-js';

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

let totalInserted = 0;
let totalSkipped = 0;
let geocodeHits = 0;
let geocodeMisses = 0;

// ========================================================================================
// 지오코딩 캐시: DB에 이미 있는 주소는 카카오 API를 호출하지 않음
// ========================================================================================
const geocodeCache = new Map();

async function loadExistingAddresses() {
    console.log('[DEDUP] Loading existing addresses from master_places...');
    const { data, error } = await supabase
        .from('master_places')
        .select('address, lat, lng')
        .not('lat', 'is', null);

    if (error) {
        console.error('[DEDUP] Failed to load existing addresses:', error.message);
        return;
    }

    for (const row of (data || [])) {
        if (row.address && row.lat && row.lng) {
            geocodeCache.set(row.address, { lat: row.lat, lng: row.lng });
        }
    }
    console.log(`[DEDUP] Loaded ${geocodeCache.size} existing addresses (geocoding skip candidates)`);
}

async function geocodeAddress(address) {
    if (!KAKAO_KEY || !address) return null;

    // 중복 스킵: 이미 지오코딩된 주소면 캐시에서 반환
    if (geocodeCache.has(address)) {
        geocodeHits++;
        return geocodeCache.get(address);
    }

    try {
        const res = await fetch(
            `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
            { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } }
        );
        const data = await res.json();
        if (data.documents && data.documents.length > 0) {
            const coords = { lat: parseFloat(data.documents[0].y), lng: parseFloat(data.documents[0].x) };
            geocodeCache.set(address, coords);
            geocodeMisses++;
            return coords;
        }

        // 주소 검색 실패 시 키워드 검색 폴백
        const kwRes = await fetch(
            `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(address)}`,
            { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } }
        );
        const kwData = await kwRes.json();
        if (kwData.documents && kwData.documents.length > 0) {
            const coords = { lat: parseFloat(kwData.documents[0].y), lng: parseFloat(kwData.documents[0].x) };
            geocodeCache.set(address, coords);
            geocodeMisses++;
            return coords;
        }
        return null;
    } catch {
        return null;
    }
}

// Upsert 유틸: 이름+주소 기반으로 중복 여부 판단
async function upsertBatch(table, items) {
    if (items.length === 0) return 0;

    // address+name 기반으로 이미 있는 건 필터링
    const addresses = items.map(i => i.address);
    const names = items.map(i => i.name);

    const { data: existing } = await supabase
        .from(table)
        .select('name, address')
        .in('address', addresses);

    const existingSet = new Set((existing || []).map(e => `${e.name}|${e.address}`));
    const newItems = items.filter(i => !existingSet.has(`${i.name}|${i.address}`));
    const skipped = items.length - newItems.length;
    totalSkipped += skipped;

    if (newItems.length === 0) {
        console.log(`  → All ${items.length} items already exist, skipped.`);
        return 0;
    }

    const { error } = await supabase.from(table).insert(newItems);
    if (error) {
        console.error(`  → Insert Error: ${error.message}`);
        return 0;
    }
    totalInserted += newItems.length;
    console.log(`  → Inserted ${newItems.length} new items (skipped ${skipped} existing)`);
    return newItems.length;
}

// ========================================================================================
// API 수집 함수들
// ========================================================================================

async function syncTourSpot() {
    console.log('\n=== [1/6] 관광명소 (TourAPI) ===');
    let pageNo = 1, hasMore = true;
    while (hasMore && pageNo <= 200) {
        try {
            const res = await fetch(`http://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${PUBLIC_API_KEY}&numOfRows=100&pageNo=${pageNo}&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=12`, fetchOptions);
            const data = await res.json();
            if (data.response?.body?.items?.item) {
                const items = Array.isArray(data.response.body.items.item) ? data.response.body.items.item : [data.response.body.items.item];
                if (items.length === 0) { hasMore = false; break; }
                if (pageNo === 1) console.log(`  Total: ${data.response.body.totalCount} items`);

                // TourAPI는 좌표를 제공하므로 지오코딩 불필요
                const chunk = items
                    .filter(i => !isNaN(parseFloat(i.mapy)) && !isNaN(parseFloat(i.mapx)))
                    .map(i => ({
                        id: crypto.randomUUID(), api_source: 'TOUR_SPOT', category: 'SPOT',
                        name: i.title, description: '한국관광공사 선정 관광명소', address: i.addr1 || i.addr2 || '',
                        lat: parseFloat(i.mapy), lng: parseFloat(i.mapx), trust_score: 40, raw_data: i,
                        sido: '', sigungu: ''
                    }));
                await upsertBatch('master_places', chunk);
                pageNo++;
                await new Promise(r => setTimeout(r, 500));
            } else { hasMore = false; }
        } catch (e) { console.error('TOUR_SPOT Error:', e.message); hasMore = false; }
    }
}

async function syncTourCafe() {
    console.log('\n=== [2/6] 카페 (TourAPI ct=39) ===');
    let pageNo = 1, hasMore = true;
    while (hasMore && pageNo <= 200) {
        try {
            const res = await fetch(`http://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${PUBLIC_API_KEY}&numOfRows=100&pageNo=${pageNo}&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=39`, fetchOptions);
            const data = await res.json();
            if (data.response?.body?.items?.item) {
                const items = Array.isArray(data.response.body.items.item) ? data.response.body.items.item : [data.response.body.items.item];
                if (items.length === 0) { hasMore = false; break; }
                if (pageNo === 1) console.log(`  Total: ${data.response.body.totalCount} items`);

                const chunk = items
                    .filter(i => (i.title.includes('카페') || i.title.includes('커피')) && !isNaN(parseFloat(i.mapy)))
                    .map(i => ({
                        id: crypto.randomUUID(), api_source: 'TOUR_CAFE', category: 'RESTAURANT',
                        name: i.title, description: '한국관광공사 등록 카페/전통찻집', address: i.addr1 || '',
                        lat: parseFloat(i.mapy), lng: parseFloat(i.mapx), trust_score: 45, raw_data: i,
                        sido: '', sigungu: ''
                    }));
                await upsertBatch('master_places', chunk);
                pageNo++;
                await new Promise(r => setTimeout(r, 500));
            } else { hasMore = false; }
        } catch (e) { console.error('TOUR_CAFE Error:', e.message); hasMore = false; }
    }
}

async function syncSmbaBacknyon() {
    console.log('\n=== [3/6] 백년가게 (SBA) ===');
    try {
        const specRes = await fetch(`https://infuser.odcloud.kr/oas/docs?namespace=${encodeURIComponent('15102255/v1')}`, fetchOptions);
        const spec = await specRes.json();
        const paths = Object.keys(spec.paths || {});
        if (paths.length === 0) { console.log('  No API path found'); return; }

        let pageNo = 1, hasMore = true;
        while (hasMore && pageNo <= 100) {
            try {
                const res = await fetch(`https://api.odcloud.kr/api${paths[0]}?serviceKey=${PUBLIC_API_KEY}&page=${pageNo}&perPage=100`, fetchOptions);
                const data = await res.json();
                if (data.data && Array.isArray(data.data) && data.data.length > 0) {
                    if (pageNo === 1) console.log(`  Total: ${data.totalCount || data.matchCount} items`);

                    const chunk = [];
                    for (const item of data.data) {
                        const addr = item['주소'] || '';
                        if (!addr || !item['업체명']) continue;
                        const coords = await geocodeAddress(addr);
                        if (!coords) continue;
                        chunk.push({
                            id: crypto.randomUUID(), api_source: 'SMBA_BAEK', category: 'RESTAURANT',
                            name: item['업체명'], description: `백년가게 공식 지정 (${item['업종'] || '식당'})`, address: addr,
                            lat: coords.lat, lng: coords.lng, trust_score: 80, raw_data: item,
                            sido: item['시도·시군구']?.split(' ')[0] || '', sigungu: item['시도·시군구']?.split(' ')[1] || ''
                        });
                        await new Promise(r => setTimeout(r, 50));
                    }
                    await upsertBatch('master_places', chunk);
                    pageNo++;
                    await new Promise(r => setTimeout(r, 500));
                } else { hasMore = false; }
            } catch (e) { console.error('SMBA Error:', e.message); hasMore = false; }
        }
    } catch (e) { console.error('SMBA Setup Error:', e.message); }
}

async function syncSafeRestaurant() {
    console.log('\n=== [4/6] 안심식당 (농림축산부) ===');
    if (!SAFE_KEY) { console.log('  SAFE_RESTAURANT_API_KEY not set, skipping.'); return; }

    let pageNo = 1, hasMore = true;
    while (hasMore && pageNo <= 100) {
        try {
            const start = (pageNo - 1) * 1000 + 1;
            const end = pageNo * 1000;
            const res = await fetch(`http://211.237.50.150:7080/openapi/${SAFE_KEY}/json/Grid_20200713000000000605_1/${start}/${end}`, fetchOptions);
            const data = await res.json();
            if (data.Grid_20200713000000000605_1?.row && data.Grid_20200713000000000605_1.row.length > 0) {
                if (pageNo === 1) console.log(`  Total: ${data.Grid_20200713000000000605_1.totalCnt} items`);
                const items = data.Grid_20200713000000000605_1.row;

                const chunk = [];
                for (const item of items) {
                    const addr = item.RELAX_ADD1 || '';
                    if (!addr || !item.RELAX_REST_NM) continue;
                    const coords = await geocodeAddress(addr);
                    if (!coords) continue;
                    chunk.push({
                        id: crypto.randomUUID(), api_source: 'SAFE_RESTAURANT', category: 'RESTAURANT',
                        name: item.RELAX_REST_NM, description: '농식품부 인증 위생 안심식당', address: addr,
                        lat: coords.lat, lng: coords.lng, trust_score: 50, raw_data: item,
                        sido: item.RELAX_SI_NM || '', sigungu: item.RELAX_SIDO_NM || ''
                    });
                    await new Promise(r => setTimeout(r, 50)); // 카카오 API 과부하 방지
                }
                await upsertBatch('master_places', chunk);
                console.log(`  Page ${pageNo} done (geocode hits: ${geocodeHits}, new calls: ${geocodeMisses})`);
                pageNo++;
                await new Promise(r => setTimeout(r, 300));
            } else { hasMore = false; }
        } catch (e) { console.error('SAFE Error:', e.message); hasMore = false; }
    }
}

async function syncMoisGoodRestaurant() {
    console.log('\n=== [5/6] 모범음식점 (행정안전부) ===');
    let pageNo = 1, hasMore = true;
    while (hasMore && pageNo <= 100) {
        try {
            const res = await fetch(`http://apis.data.go.kr/B552061/goodRestaurant/getGoodRestaurantList?serviceKey=${PUBLIC_API_KEY}&pageNo=${pageNo}&numOfRows=100&type=json`, fetchOptions);
            const text = await res.text();
            let data;
            try { data = JSON.parse(text); } catch { console.log('  Non-JSON response, skipping.'); hasMore = false; break; }

            if (data.body?.items?.item) {
                const items = Array.isArray(data.body.items.item) ? data.body.items.item : [data.body.items.item];
                if (items.length === 0) { hasMore = false; break; }

                const chunk = [];
                for (const item of items) {
                    const name = item.BPLC_NM || item.bplcNm || item.name || '';
                    const addr = item.RDNWH_ADDR || item.SITE_WHL_ADDR || item.address || '';
                    if (!addr || !name) continue;
                    const coords = await geocodeAddress(addr);
                    if (!coords) continue;
                    chunk.push({
                        id: crypto.randomUUID(), api_source: 'MOIS_GOOD_RESTAURANT', category: 'RESTAURANT',
                        name, description: '행정안전부 지정 모범음식점', address: addr,
                        lat: coords.lat, lng: coords.lng, trust_score: 55, raw_data: item,
                        sido: item.SIDO_NM || '', sigungu: item.SIGUNGU_NM || ''
                    });
                    await new Promise(r => setTimeout(r, 50));
                }
                await upsertBatch('master_places', chunk);
                pageNo++;
                await new Promise(r => setTimeout(r, 500));
            } else { hasMore = false; }
        } catch (e) { console.error('MOIS Error:', e.message); hasMore = false; }
    }
}

async function syncOpinet() {
    console.log('\n=== [6/6] 주유소 (OPINET) ===');
    if (!OPINET_KEY) { console.log('  OPINET_API_KEY not set, skipping.'); return; }

    try {
        const res = await fetch(`http://www.opinet.co.kr/api/aroundAll.do?code=${OPINET_KEY}&x=175658&y=341695&radius=10000&sort=1&prodcd=C004&out=json`, fetchOptions);
        const data = await res.json();
        if (data.RESULT?.OIL) {
            const items = Array.isArray(data.RESULT.OIL) ? data.RESULT.OIL : [data.RESULT.OIL];
            const chunk = [];
            for (const item of items) {
                const addr = item.NEW_ADR || item.VAN_ADR || '';
                const name = item.OS_NM || '';
                if (!name) continue;
                const coords = addr ? await geocodeAddress(addr) : null;
                if (!coords) continue;
                chunk.push({
                    id: crypto.randomUUID(), api_source: 'OPINET', category: 'GAS_STATION',
                    name, description: '겨울철 난방 실내등유(팬히터용) 주유소', address: addr,
                    lat: coords.lat, lng: coords.lng, trust_score: 95, raw_data: item,
                    sido: '', sigungu: ''
                });
                await new Promise(r => setTimeout(r, 50));
            }
            await upsertBatch('master_places_gas', chunk);
        }
    } catch (e) { console.error('OPINET Error:', e.message); }
}

// ========================================================================================
// Main Execution
// ========================================================================================
async function main() {
    console.log('============================================');
    console.log(' Phase 11: Master Places Weekly Full-Sync');
    console.log(' Mode: GitHub Actions Direct Runner (B안)');
    console.log('============================================\n');

    const startTime = Date.now();

    // Step 0: 기존 주소 캐시 로드 (지오코딩 중복 스킵)
    await loadExistingAddresses();

    // Step 1~6: 순차 수집
    await syncTourSpot();
    await syncTourCafe();
    await syncSmbaBacknyon();
    await syncSafeRestaurant();
    await syncMoisGoodRestaurant();
    await syncOpinet();

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log('\n============================================');
    console.log(` COMPLETE in ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
    console.log(` Inserted: ${totalInserted} items`);
    console.log(` Skipped (existing): ${totalSkipped} items`);
    console.log(` Geocode cache hits: ${geocodeHits} (saved API calls)`);
    console.log(` Geocode new calls: ${geocodeMisses}`);
    console.log('============================================');
}

main().catch(e => { console.error('Fatal Error:', e); process.exit(1); });
