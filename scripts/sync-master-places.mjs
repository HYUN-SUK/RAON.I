#!/usr/bin/env node
// ========================================================================================
// scripts/sync-master-places.mjs
// Phase 12: 주간 풀-페이지네이션 동기화 (GitHub Actions Runner 직접 실행)
// 
// [업데이트 내역]
// 1. 결정론적 ID (UUID v5): api_source + name + address 조합으로 중복 방지 및 신뢰도 분석 지원
// 2. 좌표 변환 (Proj4): 행안부 TM 좌표(EPSG:5174)를 위경도(WGS84)로 자동 변환
// 3. 파일 기반 동기화: REST API 대신 LocalData CSV/ZIP 직접 파싱 (마트, 모범음식점)
// 4. 오피넷 제외: 오피넷은 D-3 동적 캐싱으로 전환됨에 따라 주간 배치에서 제외
// ========================================================================================

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { parse } from 'csv-parse';
import iconv from 'iconv-lite';
import unzipper from 'unzipper';
import * as XLSX from 'xlsx';
import proj4 from 'proj4';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const uuidv5 = require('uuid/v5');

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const SAFE_KEY = process.env.SAFE_RESTAURANT_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !PUBLIC_API_KEY) {
    console.error('Missing required env vars');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const fetchOptions = { headers: { 'User-Agent': 'Mozilla/5.0' } };

// UUID v5 Namespace (Deterministic)
const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// Proj4 Definitions
const EPSG5174 = '+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,483.35,664.43,0.01,0.01,0.01,0.01';
const WGS84 = 'EPSG:4326';

let totalInserted = 0;
let totalSkipped = 0;

// ========================================================================================
// Helper: Deterministic ID Generation
// ========================================================================================
function generateDeterministicId(apiSource, name, address) {
    const seed = `${apiSource}|${String(name).trim()}|${String(address).trim()}`;
    return uuidv5(seed, MY_NAMESPACE);
}

// ========================================================================================
// Helper: Upsert Batch
// ========================================================================================
async function upsertBatch(table, items) {
    if (items.length === 0) return 0;
    const { error } = await supabase.from(table).upsert(items, { onConflict: 'id' });
    if (error) {
        console.error(`  → Upsert Error: ${error.message}`);
        return 0;
    }
    totalInserted += items.length;
    process.stdout.write(`\r  [PROGRESS] Total synced: ${totalInserted}...`);
    return items.length;
}

// ========================================================================================
// 1. 관광명소 (TourAPI) - API 방식 유지
// ========================================================================================
async function syncTourSpot() {
    console.log('\n=== [1/5] 관광명소 (TourAPI) ===');
    let pageNo = 1, hasMore = true;
    while (hasMore && pageNo <= 100) {
        try {
            const res = await fetch(`http://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${PUBLIC_API_KEY}&numOfRows=100&pageNo=${pageNo}&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=12`, fetchOptions);
            const data = await res.json();
            const items = data.response?.body?.items?.item;
            if (!items) { hasMore = false; break; }

            const itemList = Array.isArray(items) ? items : [items];
            const chunk = itemList
                .filter(i => i.title && !isNaN(parseFloat(i.mapy)))
                .map(i => {
                    const name = i.title;
                    const addr = i.addr1 || i.addr2 || '';
                    return {
                        id: generateDeterministicId('TOUR_SPOT', name, addr),
                        api_source: 'TOUR_SPOT', category: 'SPOT',
                        name, description: '한국관광공사 선정 관광명소', address: addr,
                        lat: parseFloat(i.mapy), lng: parseFloat(i.mapx),
                        trust_score: 40, raw_data: i
                    };
                });

            await upsertBatch('master_places', chunk);
            pageNo++;
            if (itemList.length < 100) hasMore = false;
        } catch (e) { console.error('TOUR_SPOT Error:', e.message); hasMore = false; }
    }
}

// ========================================================================================
// 2. 안심식당 / 백년가게 - API 방식 유지
// ========================================================================================
async function syncSpecialRestaurants() {
    console.log('\n=== [2/5] 안심식당 & 백년가게 ===');
    
    // 2-1. 안심식당
    if (SAFE_KEY) {
        console.log('  [INFO] Syncing Safe Restaurants...');
        let pageNo = 1;
        while (pageNo <= 20) {
            const start = (pageNo - 1) * 1000 + 1, end = pageNo * 1000;
            const res = await fetch(`http://211.237.50.150:7080/openapi/${SAFE_KEY}/json/Grid_20200713000000000605_1/${start}/${end}`, fetchOptions);
            const data = await res.json();
            const items = data.Grid_20200713000000000605_1?.row || [];
            if (items.length === 0) break;

            const chunk = [];
            for (const i of items) {
                const name = i.RELAX_REST_NM, addr = i.RELAX_ADD1;
                if (!name || !addr) continue;
                // Note: Safe API doesn't provide lat/lng, rely on geocode elsewhere or skip if no coords
                // For weekly batch consistency, we'll try to use existing coords or skip
                chunk.push({
                    id: generateDeterministicId('SAFE_RESTAURANT', name, addr),
                    api_source: 'SAFE_RESTAURANT', category: 'RESTAURANT',
                    name, description: '농식품부 인증 위생 안심식당', address: addr,
                    lat: 0, lng: 0, // Placeholder, needs geocoding backfill
                    trust_score: 50, raw_data: i
                });
            }
            // Filter out 0 coords if required by DB. master_places NOT NULL requires coords.
            // Simplified: only sync if we can get coords or use a different table
            pageNo++;
        }
    }
}

// ========================================================================================
// 3. 파일 기반 동기화 (마트, 모범음식점) - 고도화 로직
// ========================================================================================
async function syncFileBasedSources() {
    console.log('\n=== [3/5] 파일 기반 동기화 (마트, 모범음식점) ===');
    
    const sources = [
        {
            name: '대규모점포',
            url: 'https://www.localdata.go.kr/datafile/each/08_25_01_P_CSV.zip',
            referer: 'https://www.localdata.go.kr/devcenter/dataDown.do?menuNo=20001',
            category: 'MART',
            apiSource: 'LOCALDATA_MART',
            type: 'ZIP'
        },
        {
            name: '모범음식점',
            url: 'https://www.localdata.go.kr/datafile/etc/LOCALDATA_ALL_12_03_01_E.xlsx',
            referer: 'https://www.localdata.go.kr/lif/lifeMFoodMapDataView.do?menuNo=40002',
            category: 'RESTAURANT',
            apiSource: 'LOCALDATA_RESTAURANT',
            type: 'XLSX'
        }
    ];

    for (const source of sources) {
        console.log(`  [INFO] Processing ${source.name}...`);
        try {
            const res = await fetch(source.url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': source.referer } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            let records = [];
            if (source.type === 'ZIP') {
                const arrayBuffer = await res.arrayBuffer();
                const directory = await unzipper.Open.buffer(Buffer.from(arrayBuffer));
                const csvFile = directory.files.find(f => f.path.toLowerCase().endsWith('.csv'));
                const csvBuffer = await csvFile.buffer();
                const content = iconv.decode(csvBuffer, 'cp949');
                records = await new Promise((resolve) => parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true }, (e, d) => resolve(d)));
            } else {
                const buffer = await res.arrayBuffer();
                const workbook = XLSX.read(Buffer.from(buffer), { type: 'buffer' });
                records = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            }

            let batch = [];
            for (const record of (records || [])) {
                const item = mapLocalDataRecord(record, source);
                if (item) batch.push(item);
                if (batch.length >= 200) {
                    await upsertBatch('master_places', batch);
                    batch = [];
                }
            }
            if (batch.length > 0) await upsertBatch('master_places', batch);
            console.log(`\n  [DONE] ${source.name} synchronized.`);
        } catch (e) {
            console.error(`  [ERROR] ${source.name} failed:`, e.message);
        }
    }
}

function mapLocalDataRecord(record, source) {
    const keys = Object.keys(record);
    const getV = (p) => { 
        const k = keys.find(x => p.some(y => x.includes(y)));
        return k ? record[k] : null; 
    };

    const status = getV(['상세영업상태', '영업상태명', '상태명']);
    const name = getV(['사업장명', '업소명', '상호']);
    const addr = (getV(['도로명전체주소', '도로명주소']) || getV(['소재지전체주소', '소재지주소']) || '').trim();
    const posX = getV(['좌표정보x', '좌표x', '좌표(x)']);
    const posY = getV(['좌표정보y', '좌표y', '좌표(y)']);

    if (status && !String(status).includes('영업')) return null;
    if (!name || !addr) return null;

    let lat = null, lng = null;
    if (posX && posY) {
        try {
            const x = parseFloat(posX), y = parseFloat(posY);
            if (!isNaN(x) && !isNaN(y) && x > 0) {
                const coords = proj4(EPSG5174, WGS84, [x, y]);
                lng = coords[0]; lat = coords[1];
            }
        } catch (e) {}
    }

    if (!lat || !lng) return null;

    const ns = String(name).trim();
    return {
        id: generateDeterministicId(source.apiSource, ns, addr),
        api_source: source.apiSource,
        category: source.category,
        name: ns,
        address: addr,
        description: source.category === 'MART' ? '행정안전부 등록 대규모점포/마트' : '행정안전부 지정 모범음식점',
        lat, lng, trust_score: 70, raw_data: record
    };
}

// ========================================================================================
// Main
// ========================================================================================
async function main() {
    const startTime = Date.now();
    console.log('🚀 Weekly Full Sync Start (ETL 5.0)');

    await syncTourSpot();
    await syncFileBasedSources();
    // Special Restaurants (Baeknyeon, Safe) would go here if priority

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n\n🏁 COMPLETE in ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
    console.log(`Total Synced: ${totalInserted}`);
}

main().catch(console.error);
