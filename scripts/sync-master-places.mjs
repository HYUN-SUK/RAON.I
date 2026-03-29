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
const syncMap = new Map(); // id -> api_source
const geocodeCache = new Map();
let totalSynced = 0;
let geocodingCount = 0;
const syncStats = {}; // Tracks category counts
let automationLogId = null;
const sourceMetrics = {}; // { sourceName: { fetched, existing, updated, new, duration } }

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

async function upsertBatch(items, sourceName = null) {
    if (items.length === 0) return;
    const uniqueValidItems = items.filter(i => i.id && i.name && i.address);
    if (uniqueValidItems.length === 0) return;
    
    // [Unique Guard] Prevent "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const dedupeMap = new Map();
    uniqueValidItems.forEach(item => dedupeMap.set(item.id, item));
    const dedupedItems = Array.from(dedupeMap.values());

    const finalItems = [];
    let batchNew = 0;
    let batchUpdated = 0;

    for (const item of dedupedItems) {
        // [Separate Storage Principle] Each (Source, Name, Address) has a unique ID.
        const exists = syncMap.has(item.id);

        if (!item.lat || !item.lng) {
            const coords = await geocodeAddress(item.address);
            if (coords) { item.lat = coords.lat; item.lng = coords.lng; geocodingCount++; }
        }
        if (item.lat && item.lng) {
            finalItems.push({ ...item, location: `POINT(${item.lng} ${item.lat})` });
            if (exists) batchUpdated++;
            else batchNew++;
        }
    }

    if (finalItems.length === 0) return;
    
    // Final sanity check for ID uniqueness
    const ids = finalItems.map(i => i.id);
    const uniqueIds = new Set(ids);
    if (ids.length !== uniqueIds.size) {
        console.error(`\n[CRITICAL] dedupeMap failed! items: ${ids.length}, unique: ${uniqueIds.size}`);
    }

    const { error } = await supabase.from('master_places').upsert(finalItems, { onConflict: 'id' });
    if (error) {
        console.error(`\n[DB Error] ${error.message} (Batch Size: ${finalItems.length})`);
        if (error.message.includes('affect row a second time')) {
             console.log(`  Sample ID causing conflict potential: ${finalItems[0].id}`);
        }
    } else {
        totalSynced += finalItems.length;
        if (sourceName && sourceMetrics[sourceName]) {
            sourceMetrics[sourceName].new += batchNew;
            sourceMetrics[sourceName].updated += batchUpdated;
        }
        finalItems.forEach(i => {
            if (i.category) syncStats[i.category] = (syncStats[i.category] || 0) + 1;
            syncMap.set(i.id, i.api_source); // Update cache
        });
        process.stdout.write(`\r[Sync Progress] Total: ${totalSynced} items... Cache: ${geocodeCache.size}`);
    }
}

async function startLogging() {
    try {
        const { data, error } = await supabase
            .from('automation_logs')
            .insert([{
                job_name: 'MASTER_SYNC',
                status: 'RUNNING',
                message: '전국 마스터 플레이스 동기화 시작',
                created_at: new Date().toISOString()
            }])
            .select();
        if (error) throw error;
        automationLogId = data[0].id;
    } catch (e) {
        console.error('Logging start failed:', e.message);
    }
}

async function finishLogging(status, message) {
    if (!automationLogId) return;
    try {
        // sourceMetrics를 api_status 규격으로 변환
        const api_status = Object.entries(sourceMetrics).map(([name, m]) => ({
            name: name,
            label: name,
            status: 'SUCCESS',
            duration_ms: m.duration,
            fetched_count: m.fetched,
            existing_count: m.existing,
            updated_count: m.updated,
            new_count: m.new
        }));

        await supabase
            .from('automation_logs')
            .update({
                status,
                message,
                duration_ms: Date.now() - startTime,
                api_status,
                processed_count: totalSynced
            })
            .eq('id', automationLogId);
    } catch (e) {
        console.error('Logging finish failed:', e.message);
    }
}

let startTime = Date.now();
// ----------------------------------------------------------------------------------------
// [0] 관광명소 (TOUR_SPOT) - Restore v2 logic for Strategic Asset
// ----------------------------------------------------------------------------------------
async function syncTourSpot() {
    const tourStartTime = Date.now();
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
            
            const chunk = [];
            sourceMetrics['관광명소'] = sourceMetrics['관광명소'] || { fetched: 0, existing: 0, updated: 0, new: 0, duration: 0 };
            sourceMetrics['관광명소'].fetched += itemList.length;

            for (const i of itemList) {
                const id = generateId('TOUR_SPOT', i.title, i.addr1 || i.addr2 || '');
                const hasCoords = geocodeCache.has(clean(i.addr1 || i.addr2 || ''));
                
                if (syncMap.has(id) && hasCoords) {
                    sourceMetrics['관광명소'].existing++;
                    continue;
                }

                chunk.push({
                    id, api_source: 'TOUR_SPOT', category: 'SPOT',
                    name: i.title, description: '한국관광공사 등록 관광명소', address: i.addr1 || i.addr2 || '',
                    lat: parseFloat(i.mapy), lng: parseFloat(i.mapx), trust_score: 45, raw_data: i
                });
            }

            await upsertBatch(chunk, '관광명소');
            pageNo++;
            if (itemList.length < 100) hasMore = false;
        }
        sourceMetrics['관광명소'].duration = Date.now() - tourStartTime;
    } catch (e) { console.error('  TourSpot Error:', e.message); }
}

// ----------------------------------------------------------------------------------------
// [1] 백년가게 (SMBA_BAEK) - Plan A: Swagger Discovery
// ----------------------------------------------------------------------------------------
async function syncBaeknyeon() {
    const baekStartTime = Date.now();
    console.log('\n[1/3] 백년가게 (SMBA_BAEK) 동기화 중...');
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
                const hasCoords = geocodeCache.has(clean(addr));
                if (syncMap.has(id) && hasCoords) {
                    sourceMetrics['백년가게'].existing++;
                    continue;
                }

                const coords = await geocodeAddress(addr);
                chunk.push({
                    id, api_source: 'SMBA_BAEK', category: 'RESTAURANT',
                    name, address: addr, lat: coords?.lat || null, lng: coords?.lng || null, trust_score: 80, raw_data: i
                });
            }
            sourceMetrics['백년가게'] = sourceMetrics['백년가게'] || { fetched: 0, existing: 0, updated: 0, new: 0, duration: 0 };
            sourceMetrics['백년가게'].fetched += data.data.length;
            await upsertBatch(chunk, '백년가게');
        }
        sourceMetrics['백년가게'].duration = Date.now() - baekStartTime;
    } catch (e) { console.error('Baeknyeon Error:', e.message); }
}

// ----------------------------------------------------------------------------------------
// [2] 모범음식점 & 마트 (LocalData Gold Standard) - Plan B/C: File Sync
// ----------------------------------------------------------------------------------------

async function syncLocalData() {
    console.log('\n[2/3] LocalData (모범음식점/마트) 동기화 (Gold Standard)...');
    const startTime = Date.now();
    const sources = [
        { name: '대규모및준대규모점포', url: 'https://file.localdata.go.kr/file/large_scale_retail_stores/info', category: 'MART', apiSource: 'LOCALDATA_MART_LARGE', type: 'CSV_DIRECT' },
        { name: '기타식품판매업', url: 'https://file.localdata.go.kr/file/other_food_retailers/info', category: 'MART', apiSource: 'LOCALDATA_MART_OTHER', type: 'CSV_DIRECT' },
        { name: '중형슈퍼마켓', url: 'https://www.localdata.go.kr/datafile/each/07_22_13_P_CSV.zip', category: 'MART', apiSource: 'LOCALDATA_MART_SUPER', type: 'ZIP' },
        { name: '모범음식점', url: 'https://www.localdata.go.kr/datafile/etc/LOCALDATA_ALL_12_03_01_E.xlsx', category: 'RESTAURANT', apiSource: 'LOCALDATA_RESTAURANT', type: 'XLSX' }
    ];

    for (const source of sources) {
        console.log(`  -> Downloading ${source.name}...`);
        const sourceStartTime = Date.now();
        sourceMetrics[source.name] = { fetched: 0, existing: 0, updated: 0, new: 0, duration: 0 };
        try {
            let recordsList = []; 
            
            if (source.type === 'CSV_DIRECT') {
                console.log(`    Fetching direct CSV from file.localdata...`);
                const res = await fetch(source.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const content = iconv.decode(await res.arrayBuffer(), 'cp949');
                const { parse } = await import('csv-parse/sync');
                const parsed = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });
                recordsList.push(...parsed);
            } else if (source.type === 'API') {
                console.log(`    Fetching from MOIS OpenAPI...`);
                let pageNo = 1;
                while (pageNo <= 50) {
                    const url = `http://apis.data.go.kr/1741000/large_scale_retail_stores/info?serviceKey=${PUBLIC_API_KEY}&pageNo=${pageNo}&numOfRows=100&returnType=JSON`;
                    const apiRes = await fetch(url);
                    const apiData = await apiRes.json();
                    if (!apiData.response?.body?.items) break;
                    const items = apiData.response.body.items.item || [];
                    const rowItems = Array.isArray(items) ? items : [items];
                    if (rowItems.length === 0) break;

                    const activeItems = rowItems.filter((i) => i.SALS_STTS_NM === '영업/정상');
                    recordsList.push(...activeItems.map(i => ({
                        ...i,
                        사업장명: i.BPLC_NM,
                        도로명전체주소: i.ROAD_NM_ADDR || i.LOTNO_ADDR,
                        상세영업상태명: i.SALS_STTS_NM,
                        좌표정보X: i.X_CRDNT,
                        좌표정보Y: i.Y_CRDNT
                    })));
                    if (rowItems.length < 100) break;
                    pageNo++;
                }
            } else if (source.type === 'ZIP') {
                const res = await fetch(source.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const buffer = Buffer.from(await res.arrayBuffer());
                const directory = await unzipper.Open.buffer(buffer);
                const csvFiles = directory.files.filter(f => f.path.toLowerCase().endsWith('.csv'));
                
                for (const csvFile of csvFiles) {
                    console.log(`    Parsing file: ${csvFile.path}`);
                    const content = iconv.decode(await csvFile.buffer(), 'cp949');
                    const { parse } = await import('csv-parse/sync');
                    const parsed = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });
                    recordsList.push(...parsed);
                }
                console.log(`    Parsed ${recordsList.length} total records from ${csvFiles.length} files`);
            } else {
                const res = await fetch(source.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const buffer = Buffer.from(await res.arrayBuffer());
                const workbook = XLSX.read(buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const parsed = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
                recordsList.push(...parsed);
                console.log(`    Parsed ${recordsList.length} records from ${sheetName}`);
            }

            const records = recordsList; // Re-use legacy variable name for loop below
            sourceMetrics[source.name].fetched = records.length;

            let chunk = [];
            for (const r of records) {
                const name = (r.사업장명 || r.업소명 || r.상호 || r.BPLC_NM || r.bplcNm || '').trim();
                const addr = (r.도로명전체주소 || r.도로명주소 || r.소재지전체주소 || r.소재지주소 || r.RDNWHL_ADDR || r.SITE_WHL_ADDR || '').trim();
                const id = generateId(source.apiSource, name, addr);
                
                // [Source-Aware Skip] Skip only if this ID already exists AND we have coordinates
                const hasCoords = geocodeCache.has(clean(addr));
                if (syncMap.has(id) && hasCoords) {
                    sourceMetrics[source.name].existing++;
                    continue;
                }
                const status = r.상세영업상태명 || r.상세영업상태 || r.영업상태명 || r.상태명 || r.TRD_STATE_NM || r.trdStateNm || '';
                
                // [Relaxed Ingestion] Allow non-open statuses but potentially lower their score later
                if (!name || !addr) continue; 

                // Determine base trust score based on status
                const isOpen = String(status).includes('영업');
                const baseTrustScore = source.category === 'MART' ? (isOpen ? 60 : 0) : (isOpen ? 65 : 0);

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
                
                chunk.push({
                    id,
                    api_source: source.apiSource, category: source.category,
                    name: String(name).trim(), address: String(addr).trim(), lat, lng,
                    trust_score: baseTrustScore, raw_data: r
                });

                if (chunk.length >= 100) { 
                    await upsertBatch(chunk, source.name); 
                    chunk = []; 
                    // [Memory Optimization] Periodic small delay to allow GC
                    if (records.indexOf(r) % 1000 === 0) {
                        // await new Promise(r => setTimeout(r, 3000));
                    }
                }
            }
            if (chunk.length > 0) await upsertBatch(chunk, source.name);
            
            sourceMetrics[source.name].duration = Date.now() - sourceStartTime;
            console.log(`    Successfully processed ${source.name} in ${sourceMetrics[source.name].duration}ms`);
        } catch (e) {
 console.error(`  ${source.name} Error:`, e.message); }
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
                const hasCoords = geocodeCache.has(clean(addr));
                if (syncMap.has(id) && hasCoords) {
                    sourceMetrics['안심식당'].existing++;
                    continue;
                }

                const coords = geocodeCache.get(String(addr).trim()) || await geocodeAddress(addr);
                chunk.push({
                    id, api_source: 'SAFE_RESTAURANT', category: 'RESTAURANT',
                    name, address: addr, lat: coords?.lat || null, lng: coords?.lng || null, trust_score: 60, raw_data: i
                });
            }
            sourceMetrics['안심식당'] = sourceMetrics['안심식당'] || { fetched: 0, existing: 0, updated: 0, new: 0, duration: 0 };
            sourceMetrics['안심식당'].fetched += items.length;
            await upsertBatch(chunk, '안심식당');
        }
    } catch (e) { console.error('Safe Error:', e.message); }
}

async function main() {
    startTime = Date.now();
    await startLogging();
    
    try {
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
        
        console.log(`\n\n🏁 Done. Total ${totalSynced} (Geocoded: ${geocodingCount})`);
        await finishLogging('SUCCESS', '전국 마스터 플레이스 동기화 완료');
        process.exit(0);
    } catch (e) {
        console.error('\n!!! CRITICAL ERROR !!!', e);
        await finishLogging('FAILURE', `치명적 오류: ${e.message}`);
        process.exit(1);
    }
}

main();
