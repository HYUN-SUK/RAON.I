import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { v5 as uuidv5 } from 'uuid';
import iconv from 'iconv-lite';
import unzipper from 'unzipper';
import proj4 from 'proj4';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const EPSG5174 = '+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,483.35,664.43,0.01,0.01,0.01,0.01';
const WGS84 = 'EPSG:4326';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function clean(str) { return String(str || '').replace(/[^a-zA-Z0-9가-힣\s]/g, '').replace(/\s+/g, ' ').trim(); }

async function geocodeAddress(address) {
    if (!address) return null;
    try {
        const res = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`, {
            headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` }
        });
        const data = await res.json();
        if (data.documents?.[0]) {
            return { lat: parseFloat(data.documents[0].y), lng: parseFloat(data.documents[0].x) };
        }
        return null;
    } catch (e) { return null; }
}

async function upsertBatch(items) {
    const { error } = await supabase.from('master_places').upsert(items, { onConflict: 'id' });
    if (error) console.error('Upsert Error:', error.message);
    else console.log(`- Upserted ${items.length} items.`);
}

async function syncMarts() {
    console.log('🚀 Starting Targeted Mart Sync...');
    const sources = [
        { name: '대규모마트', url: 'https://www.localdata.go.kr/datafile/each/08_25_01_P_CSV.zip', category: 'MART', apiSource: 'LOCALDATA_MART_LARGE', type: 'ZIP' },
        { name: '준대규모마트', url: 'API_MOIS_SSM', category: 'MART', apiSource: 'LOCALDATA_MART_SSM', type: 'API' },
        { name: '중형슈퍼마켓', url: 'https://www.localdata.go.kr/datafile/each/07_22_13_P_CSV.zip', category: 'MART', apiSource: 'LOCALDATA_MART_SUPER', type: 'ZIP' }
    ];

    for (const source of sources) {
        console.log(`\n📦 Processing: ${source.name}`);
        let rawList = [];

        if (source.type === 'API') {
            console.log(`  Fetching from MOIS OpenAPI...`);
            let pageNo = 1;
            while (pageNo <= 42) {
                const url = `http://apis.data.go.kr/1741000/large_scale_retail_stores/info?serviceKey=${PUBLIC_API_KEY}&pageNo=${pageNo}&numOfRows=100&returnType=JSON`;
                try {
                    const res = await fetch(url);
                    const data = await res.json();
                    if (!data.response?.body?.items) break;
                    const items = data.response.body.items.item || [];
                    const rowItems = Array.isArray(items) ? items : [items];
                    const activeItems = rowItems.filter(i => i.SALS_STTS_NM === '영업/정상');
                    rawList.push(...activeItems.map(i => ({
                        name: i.BPLC_NM, address: i.ROAD_NM_ADDR || i.LOTNO_ADDR,
                        status: i.SALS_STTS_NM, posX: i.X_CRDNT, posY: i.Y_CRDNT
                    })));
                    process.stdout.write(`\r  - Page ${pageNo}: ${rawList.length} active records...`);
                    if (rowItems.length < 100) break;
                    pageNo++;
                } catch (e) { break; }
            }
            console.log();
        } else if (source.type === 'ZIP') {
            try {
                const res = await fetch(source.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const buffer = Buffer.from(await res.arrayBuffer());
                const directory = await unzipper.Open.buffer(buffer);
                const csvFiles = directory.files.filter(f => f.path.toLowerCase().endsWith('.csv'));
                for (const csvFile of csvFiles) {
                    const content = iconv.decode(await csvFile.buffer(), 'cp949');
                    const lines = content.split('\n');
                    for (let i = 1; i < lines.length; i++) {
                        const r = lines[i].split(',');
                        if (r.length < 20) continue;
                        rawList.push({
                            name: r[18], address: r[26] || r[25], status: r[12], posX: r[27], posY: r[28]
                        });
                    }
                }
                console.log(`  - Parsed ${rawList.length} records from CSV.`);
            } catch (e) { console.error('ZIP Error:', e.message); }
        }

        const seenIdsInProcess = new Set();
        let chunk = [];
        for (const r of rawList) {
            const name = String(r.name || '').trim();
            const addr = String(r.address || '').trim();
            if (!name || !addr || !r.status?.includes('영업')) continue;

            const id = uuidv5(`${source.apiSource}|${clean(name)}|${clean(addr)}`, MY_NAMESPACE);
            if (seenIdsInProcess.has(id)) continue;
            seenIdsInProcess.add(id);

            let lat = null, lng = null;

            if (r.posX && r.posY) {
                try {
                    const x = parseFloat(r.posX), y = parseFloat(r.posY);
                    if (x > 0) {
                        const coords = proj4(EPSG5174, WGS84, [x, y]);
                        lng = coords[0]; lat = coords[1];
                    }
                } catch(e) {}
            }

            if (!lat || !lng) {
                const coords = await geocodeAddress(addr);
                if (coords) { lat = coords.lat; lng = coords.lng; }
            }

            if (!lat || !lng) continue;

            chunk.push({
                id, api_source: source.apiSource, category: source.category,
                name, address: addr, lat, lng, trust_score: 60, raw_data: r
            });

            if (chunk.length >= 100) {
                await upsertBatch(chunk);
                chunk = [];
            }
        }
        if (chunk.length > 0) await upsertBatch(chunk);
    }
    console.log('✅ Mart-Only Sync Complete!');
}

syncMarts();
