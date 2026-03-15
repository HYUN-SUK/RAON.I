const { createClient } = require('@supabase/supabase-js');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const unzipper = require('unzipper');
const iconv = require('iconv-lite');
const { parse } = require('csv-parse/sync');
const { v5: uuidv5 } = require('uuid');
const proj4 = require('proj4');
require('dotenv').config({ path: '.env.local' });

const NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
const EPSG5174 = '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43';
const WGS84 = 'EPSG:4326';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function generateId(source, name, address) {
    return uuidv5(`${source}:${(name||'').trim()}:${(address||'').trim()}`, NAMESPACE);
}

async function testSingleMart() {
    console.log('--- SURGICAL MART TEST ---');
    const url = 'https://www.localdata.go.kr/datafile/each/08_25_01_P_CSV.zip';
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const buffer = Buffer.from(await res.arrayBuffer());
    const directory = await unzipper.Open.buffer(buffer);
    const csvFile = directory.files.find(f => f.path.toLowerCase().endsWith('.csv'));
    const content = iconv.decode(await csvFile.buffer(), 'cp949');
    const records = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });
    
    console.log('Keys:', Object.keys(records[0]));
    console.log('First Record Values:', JSON.stringify(records[0], null, 2));

    // Pick ANY open business record
    const r = records.find(x => String(x.상세영업상태명 || x.상세영업상태 || '').includes('영업'));
    if (!r) { console.log('No suitable record found'); return; }
    
    console.log(`Testing record: ${r.사업장명} (${r.소재지전체주소})`);
    const name = r.사업장명.trim(), addr = r.소재지전체주소.trim(), status = r.상세영업상태명;
    
    const id = generateId('LOCALDATA_MART', name, addr);
    console.log(`Generated ID: ${id}`);
    
    // Check if ID already exists
    const { data: existing } = await supabase.from('master_places').select('id, api_source').eq('id', id).single();
    if (existing) {
        console.log(`ID already exists with sources: ${existing.api_source}`);
    } else {
        console.log('ID not found in DB. Good.');
    }
    
    // Map coords
    let lat = null, lng = null;
    const keys = Object.keys(r);
    const xKey = keys.find(k => k.includes('좌표') && (k.includes('x') || k.includes('X')));
    const yKey = keys.find(k => k.includes('좌표') && (k.includes('y') || k.includes('Y')));
    
    if (xKey && yKey) {
        const x = parseFloat(r[xKey]), y = parseFloat(r[yKey]);
        if (x > 0) {
            const coords = proj4(EPSG5174, WGS84, [x, y]);
            lng = coords[0]; lat = coords[1];
        }
    }
    console.log(`Mapped Coords: lat=${lat}, lng=${lng}`);
    
    if (lat && lng) {
        const item = {
            id, name, address: addr, lat, lng, 
            api_source: 'LOCALDATA_MART', category: 'MART', raw_data: r, trust_score: 60
        };
        const { error } = await supabase.from('master_places').upsert(item, { onConflict: 'id' });
        if (error) {
            console.error('Upsert Error:', error.message);
            if (error.code === '23505') {
                 const { data: conflict } = await supabase.from('master_places').select('id, api_source').eq('name', name).eq('address', addr).single();
                 console.log(`Conflict on name/address with record ID: ${conflict.id}, current sources: ${conflict.api_source}`);
            }
        } else {
            console.log('SUCCESS: Ingested!');
        }
    } else {
        console.log('FAIL: No coordinates');
    }
}

testSingleMart();
