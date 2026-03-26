import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { v5 as uuidv5 } from 'uuid';
import proj4 from 'proj4';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;
const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const EPSG5174 = '+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,483.35,664.43,0.01,0.01,0.01,0.01';
const WGS84 = 'EPSG:4326';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function clean(s) { return String(s || '').trim(); }
function generateId(source, name, address) {
    return uuidv5(`${source}|${clean(name)}|${clean(address)}`, MY_NAMESPACE);
}

async function syncSSM() {
    console.log('🚀 SSM (준대규모점포) API Sync Start (Inclusive)...');
    let pageNo = 1;
    let totalSynced = 0;
    let totalMissed = 0;
    const apiSource = 'LOCALDATA_MART_SSM';

    while (true) {
        const url = `http://apis.data.go.kr/1741000/large_scale_retail_stores/info?serviceKey=${PUBLIC_API_KEY}&pageNo=${pageNo}&numOfRows=100&returnType=JSON&cond[SALS_STTS_CD::EQ]=01`;
        
        try {
            const res = await fetch(url);
            const data = await res.json();
            
            if (!data.response || !data.response.body) {
                console.log(`  - Page ${pageNo} ended (Invalid response). Total: ${totalSynced}`);
                break;
            }
            
            const totalInAPI = data.response.body.totalCount || 0;
            if (pageNo === 1) console.log(`  - Nationwide Total from API: ${totalInAPI}`);

            const rawItems = data.response.body.items?.item || [];
            const items = Array.isArray(rawItems) ? rawItems : (rawItems ? [rawItems] : []);
            if (items.length === 0) break;

            let missedInBatch = 0;
            const batch = items.map(i => {
                const name = clean(i.BPLC_NM || i.bplcNm);
                const addr = clean(i.ROAD_NM_ADDR || i.rdnWhlAddr || i.SITE_WHL_ADDR || i.siteWhlAddr || i.LOTNO_ADDR);
                const id = generateId(apiSource, name, addr);

                let lat = null, lng = null;
                const posX = i.CRD_INFO_X || i.x;
                const posY = i.CRD_INFO_Y || i.y;

                if (posX && posY) {
                    try {
                        const x = parseFloat(posX), y = parseFloat(posY);
                        if (x > 0) {
                            const coords = proj4(EPSG5174, WGS84, [x, y]);
                            lng = coords[0]; lat = coords[1];
                        }
                    } catch(projErr) {}
                }

                return {
                    id,
                    api_source: apiSource,
                    category: 'MART',
                    name,
                    address: addr,
                    lat, lng,
                    trust_score: 60,
                    raw_data: i
                };
            }).filter(i => {
                if (i.id && i.name && i.address) return true;
                missedInBatch++;
                return false;
            });

            if (batch.length > 0) {
                for (const item of batch) {
                    const { error: upsertErr } = await supabase.from('master_places').upsert(item, { onConflict: 'id' });
                    if (upsertErr) {
                        console.error(`\n  [FAIL] ${item.name}: ${upsertErr.message}`);
                        console.error(`  - Item ID: [${item.id}]`);
                        console.error(`  - Lat/Lng: ${item.lat}, ${item.lng}`);
                    } else {
                        totalSynced++;
                        process.stdout.write(`\r  - Progress: Page ${pageNo}, Total ${totalSynced} SSM items (Missed: ${totalMissed + missedInBatch})...`);
                    }
                }
            }
            totalMissed += missedInBatch;

            if (items.length < 100) {
                console.log(`\n🏁 Last page reached at Page ${pageNo}. Final Sync Count: ${totalSynced}`);
                break;
            }
            pageNo++;
        } catch (e) {
            console.error(`\n  - Critical Process Failure:`, e.stack || e.message);
            break;
        }
    }

    console.log(`\n\n🏁 SSM Sync Done. Total Synced: ${totalSynced}`);
}

syncSSM();
