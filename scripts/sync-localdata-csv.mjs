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

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing required env vars');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Fixed namespace for deterministic UUID generation
const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// Coordinate transformation: EPSG:5174 to EPSG:4326 (WGS84)
const EPSG5174 = '+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,483.35,664.43,0.01,0.01,0.01,0.01';
const WGS84 = 'EPSG:4326';

const DATA_SOURCES = [
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

async function processSource(source) {
    console.log(`\n🚀 [START] Processing ${source.name}...`);
    try {
        const response = await fetch(source.url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': source.referer
            }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        let records = [];
        if (source.type === 'ZIP') {
            const arrayBuffer = await response.arrayBuffer();
            const directory = await unzipper.Open.buffer(Buffer.from(arrayBuffer));
            const csvFile = directory.files.find(f => f.path.toLowerCase().endsWith('.csv'));
            const csvBuffer = await csvFile.buffer();
            const content = iconv.decode(csvBuffer, 'cp949');
            
            records = await new Promise((resolve, reject) => {
                parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true }, (err, data) => {
                    if (err) reject(err); else resolve(data);
                });
            });
        } else if (source.type === 'XLSX') {
            const buffer = await response.arrayBuffer();
            const workbook = XLSX.read(Buffer.from(buffer), { type: 'buffer' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            records = XLSX.utils.sheet_to_json(sheet);
        }

        console.log(`  [INFO] Synchronizing ${records.length} records...`);
        let count = 0;
        let batch = [];
        const seen = new Set();

        for (const record of records) {
            const item = mapRecord(record, source);
            if (item) {
                if (seen.has(item.id)) continue;
                seen.add(item.id);
                batch.push(item);
            }

            if (batch.length >= 200) {
                const { error } = await supabase.from('master_places').upsert(batch, { onConflict: 'id' });
                if (error) {
                    console.error(`\n❌ [ERROR] Batch failed: ${error.message}`);
                } else {
                    count += batch.length;
                    process.stdout.write(`\r[SYNC] ${source.name}: ${count} items upserted...`);
                }
                batch = [];
            }
        }
        
        if (batch.length > 0) {
            const { error } = await supabase.from('master_places').upsert(batch, { onConflict: 'id' });
            if (!error) count += batch.length;
        }
        console.log(`\n✅ [FINISH] ${source.name}: Total ${count} records synced.`);
    } catch (err) {
        console.error(`\n❌ [FATAL] ${source.name}: ${err.message}`);
    }
}

function mapRecord(record, source) {
    const keys = Object.keys(record);
    const getV = (patterns) => { 
        const key = keys.find(k => patterns.some(p => k.includes(p)));
        return key ? record[key] : null; 
    };

    const status = getV(['상세영업상태', '영업상태명', '상태명']);
    const name = getV(['사업장명', '업소명', '상호']);
    const roadAddr = getV(['도로명전체주소', '도로명주소']);
    const jibunAddr = getV(['소재지전체주소', '소재지주소']);
    const posX = getV(['좌표정보x', '좌표x', '좌표(x)']);
    const posY = getV(['좌표정보y', '좌표y', '좌표(y)']);

    if (status && !String(status).includes('영업')) return null;
    if (!name) return null;
    
    const address = (roadAddr || jibunAddr || '').trim();
    if (!address) return null;

    const ns = String(name).trim();
    if (!ns || ns === 'null' || ns === 'undefined') return null;

    let lat = null, lng = null;
    if (posX && posY) {
        try {
            const x = parseFloat(posX);
            const y = parseFloat(posY);
            if (!isNaN(x) && !isNaN(y) && x > 0 && y > 0) {
                const coords = proj4(EPSG5174, WGS84, [x, y]);
                lng = coords[0];
                lat = coords[1];
            }
        } catch (e) {}
    }

    if (!lat || !lng) return null;

    // Generate deterministic ID
    const id = uuidv5(`${ns}|${address}`, MY_NAMESPACE);

    return {
        id: id,
        api_source: source.apiSource,
        category: source.category,
        name: ns,
        address: address,
        description: source.name === '모범음식점' ? '행정안전부 지정 모범음식점' : '행정안전부 등록 대규모점포/마트',
        lat: lat,
        lng: lng,
        trust_score: 70,
        raw_data: record
    };
}

async function main() {
    for (const source of DATA_SOURCES) {
        await processSource(source);
    }
}

main();
