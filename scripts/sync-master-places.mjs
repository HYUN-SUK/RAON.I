#!/usr/bin/env node
/**
 * @file master-sync-reliability.mjs
 * @description 스마트 캠핑 플랜 ETL 5.2 - 전국 데이터 통합 동기화 (SSOT Gold Standard)
 * [핵심 전략]
 * 1. 백년가게: ODcloud Swagger 자동 탐색 (Plan A)
 * 2. 모범음식점/마트: LocalData CSV/XLSX 직접 동기화 (Plan B/C - 안정성 확보)
 * 3. 안심식당: 농식품부 공공 API (실시간성 확보)
 * 4. 공통: UUID v5 결정론적 ID + 지오코딩 캐시 활용
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { v5 as uuidv5 } from 'uuid';
import iconv from 'iconv-lite';
import unzipper from 'unzipper';
import * as XLSX from 'xlsx';
import proj4 from 'proj4';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;
const SAFE_KEY = process.env.SAFE_RESTAURANT_API_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const EPSG5174 = '+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,483.35,664.43,0.01,0.01,0.01,0.01';
const WGS84 = 'EPSG:4326';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing required env vars');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const syncMap = new Map(); // id -> existingSources (string)
const nameAddressMap = new Map(); // "name|address" -> id
const geocodeCache = new Map();
let totalSynced = 0;
let geocodingCount = 0;
const syncStats = {}; // Tracks category counts
// Quota removed for full recovery session

function clean(s) { return String(s || '').trim(); }

function generateId(source, name, address) {
    return uuidv5(`${source}|${clean(name)}|${clean(address)}`, MY_NAMESPACE);
}

async function geocodeAddress(address) {
    if (!KAKAO_KEY || !address) return null;
    const cleanAddr = String(address).trim();
    if (geocodeCache.has(cleanAddr)) return geocodeCache.get(cleanAddr);
    
    await new Promise(r => setTimeout(r, 500)); // Throttling (Manual Sec 6.2 - Bulk Recovery Mode)
    try {
        const res = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(cleanAddr)}`, {
            headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` }
        });
        const data = await res.json();
        if (data.documents?.length > 0) {
            const coords = { lat: parseFloat(data.documents[0].y), lng: parseFloat(data.documents[0].x) };
            geocodeCache.set(cleanAddr, coords);
            return coords;
        }
    } catch (e) {}
    return null;
}

async function upsertBatch(items) {
    const seenIds = new Set();
    const uniqueValidItems = [];
    for (const item of items) {
        if (item.name && item.address && item.lat !== null && item.lng !== null && !seenIds.has(item.id)) {
            seenIds.add(item.id);
            uniqueValidItems.push(item);
        }
    }
    const finalItems = [];
    for (const item of uniqueValidItems) {
        // [Fast Conflict Resolution] Check Name+Address index
        const key = `${clean(item.name).toLowerCase()}|${clean(item.address).toLowerCase()}`;
        const existingId = nameAddressMap.get(key);
        
        if (existingId) {
            item.id = existingId; // Use existing ID to trigger update instead of conflict
        }

        const existingSources = syncMap.get(item.id) || '';
        if (existingSources && !existingSources.includes(item.api_source)) {
            // Merge sources
            const merged = [...new Set([...existingSources.split(',').map(s => s.trim()), item.api_source])].join(', ');
            item.api_source = merged;
        }
        finalItems.push(item);
    }

    if (finalItems.length === 0) return;
    const { error } = await supabase.from('master_places').upsert(finalItems, { onConflict: 'id' });
    if (error) {
        if (error.code === '23505' && error.message.includes('master_places_name_address_key')) {
            // Conflict on name/address. We need to find the existing record and merge api_source.
            for (const item of uniqueValidItems) {
                const { data: existing } = await supabase.from('master_places').select('id, api_source').eq('name', item.name).eq('address', item.address).single();
                if (existing) {
                    if (!existing.api_source.includes(item.api_source)) {
                        const newSources = [...new Set([...existing.api_source.split(','), item.api_source])].join(',');
                        await supabase.from('master_places').update({ api_source: newSources }).eq('id', existing.id);
                    }
                } else {
                    // Actual PK conflict or other error
                    await supabase.from('master_places').upsert([item], { onConflict: 'id' }).catch(() => {});
                }
            }
        } else {
            console.error(`\n[DB Error] ${error.message} - ${error.details || ''}`);
        }
    } else {
        totalSynced += uniqueValidItems.length;
        uniqueValidItems.forEach(i => {
            if (i.category) syncStats[i.category] = (syncStats[i.category] || 0) + 1;
        });
        process.stdout.write(`\r[Sync Progress] Total: ${totalSynced} items... Cache: ${geocodeCache.size}`);
    }
}

// ----------------------------------------------------------------------------------------
// [0] 관광명소 (TOUR_SPOT) - Restore v2 logic for Strategic Asset
// ----------------------------------------------------------------------------------------
async function syncTourSpot() {
    console.log('\n[0/3] 관광명소 (TOUR_SPOT) 동기화 중...');
    if (!PUBLIC_API_KEY) return;
    let pageNo = 1, hasMore = true;
    try {
        while (hasMore && pageNo <= 100) {
            const res = await fetch(`http://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${PUBLIC_API_KEY}&numOfRows=100&pageNo=${pageNo}&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=12`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const data = await res.json();
            const items = data.response?.body?.items?.item;
            if (!items) { hasMore = false; break; }
            const itemList = (Array.isArray(items) ? items : [items]).filter(i => !isNaN(parseFloat(i.mapy)));
            
            const chunk = itemList.map(i => ({
                id: generateId('TOUR_SPOT', i.title, i.addr1 || i.addr2 || ''),
                api_source: 'TOUR_SPOT', category: 'SPOT',
                name: i.title, description: '한국관광공사 등록 관광명소', address: i.addr1 || i.addr2 || '',
                lat: parseFloat(i.mapy), lng: parseFloat(i.mapx), trust_score: 45, raw_data: i
            }));
            
            await upsertBatch(chunk);
            pageNo++;
            if (itemList.length < 100) hasMore = false;
        }
    } catch (e) { console.error('  TourSpot Error:', e.message); }
}

// ----------------------------------------------------------------------------------------
// [1] 백년가게 (SMBA_BAEK) - Plan A: Swagger Discovery
// ----------------------------------------------------------------------------------------
async function syncBaeknyeon() {
    console.log('\n[1/3] 백년가게 (SMBA_BAEK) 동송화 중...');
    try {
        const spec = await fetch(`https://infuser.odcloud.kr/oas/docs?namespace=15102255/v1`).then(r => r.json());
        const path = Object.keys(spec.paths || {})[0];
        for (let page = 1; page <= 20; page++) {
            const data = await fetch(`https://api.odcloud.kr/api${path}?serviceKey=${PUBLIC_API_KEY}&page=${page}&perPage=100`).then(r => r.json());
            if (!data.data || data.data.length === 0) break;
            const chunk = [];
            for (const i of data.data) {
                const name = i['업체명'], addr = i['주소'] || i['기본주소'];
                const id = generateId('SMBA_BAEK', name, addr);
                const existingSources = syncMap.get(id) || '';
                const hasCoords = geocodeCache.has(clean(addr));
                if (existingSources.includes('SMBA_BAEK') && hasCoords) continue;

                const coords = await geocodeAddress(addr);
                chunk.push({
                    id, api_source: 'SMBA_BAEK', category: 'RESTAURANT',
                    name, address: addr, lat: coords?.lat || null, lng: coords?.lng || null, trust_score: 80, raw_data: i
                });
            }
            await upsertBatch(chunk);
        }
    } catch (e) { console.error('Baeknyeon Error:', e.message); }
}

// ----------------------------------------------------------------------------------------
// [2] 모범음식점 & 마트 (LocalData Gold Standard) - Plan B/C: File Sync
// ----------------------------------------------------------------------------------------

async function syncLocalData() {
    console.log('\n[2/3] LocalData (모범음식점/마트) 동기화 (Gold Standard)...');
    const sources = [
        { name: '마트', url: 'https://www.localdata.go.kr/datafile/each/08_25_01_P_CSV.zip', category: 'MART', apiSource: 'LOCALDATA_MART', type: 'ZIP' },
        { name: '모범음식점', url: 'https://www.localdata.go.kr/datafile/etc/LOCALDATA_ALL_12_03_01_E.xlsx', category: 'RESTAURANT', apiSource: 'LOCALDATA_RESTAURANT', type: 'XLSX' }
    ];

    for (const source of sources) {
        console.log(`  -> Downloading ${source.name}...`);
        try {
            const res = await fetch(source.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            let records = [];
            if (source.type === 'ZIP') {
                const buffer = Buffer.from(await res.arrayBuffer());
                const directory = await unzipper.Open.buffer(buffer);
                const csvFile = directory.files.find(f => f.path.toLowerCase().endsWith('.csv'));
                const content = iconv.decode(await csvFile.buffer(), 'cp949');
                const { parse } = await import('csv-parse/sync');
                records = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });
            } else {
                const buffer = Buffer.from(await res.arrayBuffer());
                const workbook = XLSX.read(buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                records = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
                console.log(`    Parsed ${records.length} records from ${sheetName}`);
            }

            let chunk = [];
            for (const r of records) {
                const name = (r.사업장명 || r.업소명 || r.상호 || r.BPLC_NM || r.bplcNm || '').trim();
                const addr = (r.도로명전체주소 || r.소재지전체주소 || r.RDNWHL_ADDR || r.SITE_WHL_ADDR || '').trim();
                const id = generateId(source.apiSource, name, addr);
                
                // [Source-Aware Skip] Skip only if this source is already recorded AND we have coordinates
                const existingSources = syncMap.get(id) || '';
                const hasCoords = geocodeCache.has(clean(addr));
                if (existingSources.includes(source.apiSource) && hasCoords) continue;
                const status = r.상세영업상태명 || r.상세영업상태 || r.영업상태명 || r.상태명 || r.TRD_STATE_NM || r.trdStateNm || '';
                
                if (!name || !addr || (status && !String(status).includes('영업'))) continue;

                let lat = null, lng = null;
                // [Robust Mapping] Search for coordinate keys dynamically
                let posX = null, posY = null;
                const keys = Object.keys(r);
                const xKey = keys.find(k => k.includes('좌표') && (k.includes('x') || k.includes('X')));
                const yKey = keys.find(k => k.includes('좌표') && (k.includes('y') || k.includes('Y')));
                
                if (xKey && yKey) {
                    posX = r[xKey]; posY = r[yKey];
                } else {
                    posX = r.X || r.x || r['좌표정보(X)'] || r['좌표정보(x)'];
                    posY = r.Y || r.y || r['좌표정보(Y)'] || r['좌표정보(y)'];
                }

                if (posX && posY) {
                    const x = parseFloat(posX), y = parseFloat(posY);
                    if (x > 0) {
                        try {
                            const coords = proj4(EPSG5174, WGS84, [x, y]);
                            lng = coords[0]; lat = coords[1];
                        } catch(e) {}
                    }
                }
                
                if (!lat || !lng) {
                    // [Full Recovery Mode] Recover all missing coordinates
                    const coords = await geocodeAddress(addr);
                    if (coords) {
                        lat = coords.lat; lng = coords.lng;
                        geocodingCount++;
                    }
                }

                if (!lat || !lng) continue; // Still no coordinates after attempt or quota reached
                
                // Rate limit defense for LocalData processing batching
                if (chunk.length >= 100) { 
                    await upsertBatch(chunk); 
                    chunk = []; 
                    await new Promise(r => setTimeout(r, 3000)); 
                }

                chunk.push({
                    id,
                    api_source: source.apiSource, category: source.category,
                    name: String(name).trim(), address: String(addr).trim(), lat, lng,
                    trust_score: source.category === 'MART' ? 60 : 65, raw_data: r
                });
                if (chunk.length >= 100) { 
                    await upsertBatch(chunk); 
                    chunk = []; 
                    // [Memory Optimization] Periodic small delay to allow GC
                    if (records.indexOf(r) % 1000 === 0) {
                        await new Promise(r => setTimeout(r, 3000));
                    }
                }
            }
            if (chunk.length > 0) await upsertBatch(chunk);
        } catch (e) { console.error(`  ${source.name} Error:`, e.message); }
    }
}

// ----------------------------------------------------------------------------------------
// [3] 안심식당 (SAFE_RESTAURANT) - API Sync
// ----------------------------------------------------------------------------------------
async function syncSafe() {
    console.log('\n[3/3] 안심식당 (SAFE_RESTAURANT) 동기화...');
    if (!SAFE_KEY) return;

    try {
        for (let page = 1; page <= 75; page++) {
            const start = (page - 1) * 1000 + 1, end = page * 1000;
            const res = await fetch(`http://211.237.50.150:7080/openapi/${SAFE_KEY}/json/Grid_20200713000000000605_1/${start}/${end}`);
            const data = await res.json().catch(() => ({}));
            const items = data.Grid_20200713000000000605_1?.row || [];
            if (items.length === 0) break;
            const chunk = [];
            for (const i of items) {
                const name = i.RELAX_REST_NM, addr = i.RELAX_ADD1;
                const id = generateId('SAFE_RESTAURANT', name, addr);
                const existingSources = syncMap.get(id) || '';
                const hasCoords = geocodeCache.has(clean(addr));
                if (existingSources.includes('SAFE_RESTAURANT') && hasCoords) continue;

                const coords = geocodeCache.get(String(addr).trim()) || await geocodeAddress(addr);
                chunk.push({
                    id, api_source: 'SAFE_RESTAURANT', category: 'RESTAURANT',
                    name, address: addr, lat: coords?.lat || null, lng: coords?.lng || null, trust_score: 60, raw_data: i
                });
            }
            await upsertBatch(chunk);
        }
    } catch (e) { console.error('Safe Error:', e.message); }
}

async function main() {
    const startTime = Date.now();
    console.log('🚀 RAONAI NATIONWIDE CONSOLIDATED SYNC (Gold Standard)');
    
    // Improved argument parsing
    const args = process.argv.slice(2);
    const category = args.find(a => a.startsWith('--category='))?.split('=')[1] || 
                     (args.includes('--category') ? args[args.indexOf('--category') + 1] : null);

    // Global Pre-fetch (Full Database Audit)
    console.log('    Pre-fetching existing records for ultra-fast skip...');
    let pageCount = 0;
    const pageSize = 1000;
    while (true) {
        const { data, error } = await supabase.from('master_places')
            .select('id, name, address, lat, lng, api_source')
            .range(pageCount * pageSize, (pageCount + 1) * pageSize - 1)
            .order('id');
        
        if (error) { console.error('Pre-fetch error:', error.message); break; }
        if (!data || data.length === 0) break;
        
        data.forEach(r => {
            syncMap.set(r.id, r.api_source || '');
            const key = `${clean(r.name).toLowerCase()}|${clean(r.address).toLowerCase()}`;
            nameAddressMap.set(key, r.id);

            // Also add address-based ID to handle source name changes
            const sources = (r.api_source || '').split(',');
            sources.forEach(s => {
                const legacyId = generateId(s.trim(), '', r.address); // Note: Simple addr check if name unknown
                syncMap.set(legacyId, r.api_source || '');
            });
            if (r.address && r.lat && r.lng) {
                geocodeCache.set(clean(r.address), { lat: r.lat, lng: r.lng });
            }
        });
        pageCount++;
        if (data.length < pageSize) break;
        if (pageCount % 10 === 0) process.stdout.write(`\r    Loaded ${syncMap.size} records into memory...`);
    }
    console.log(`\n    Initial Cache: ${geocodeCache.size}, Sync Map: ${syncMap.size}`);

    if (!category || category === 'SPOT') await syncTourSpot();
    if (!category || category === 'BAEK') await syncBaeknyeon();
    if (!category || category === 'LOCALDATA') await syncLocalData();
    if (!category || category === 'SAFE_RESTAURANT') await syncSafe();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`\n\n🏁 Done. Total ${totalSynced} (Geocoded: ${geocodingCount})`);

    // Log to Supabase
    await supabase.from('automation_logs').insert({
        job_name: 'MASTER_SYNC',
        status: 'SUCCESS', // Always SUCCESS if it finishes without fatal error (0 updates is normal)
        processed_count: totalSynced,
        message: JSON.stringify({
            total_synced: totalSynced,
            geocoded: geocodingCount,
            category_breakdown: syncStats
        }),
        duration_ms: duration
    });
}

main().catch(err => {
    console.error('Fatal Sync Error:', err);
    process.exit(1);
});
