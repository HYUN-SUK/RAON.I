import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;

// Hybrid AreaCode Map (Mix of Legal for Metros, Legacy for Provinces)
const REGN_MAP = {
    '서울특별시': '1', '인천광역시': '2', '대전광역시': '3', '대구광역시': '4', 
    '광주광역시': '5', '부산광역시': '6', '울산광역시': '7', '세종특별자치시': '8',
    '경기도': '31', '강원특별자치도': '32', '충청북도': '33', '충청남도': '34',
    '경상북도': '35', '경상남도': '36', '전북특별자치도': '37', '전라남도': '38', '제주특별자치도': '39'
};

// We also need a way to map Sigungu names to KTO SigunguCodes for legacy regions.
// Since we don't have a full map, we'll try to extract 'sigunguCode' from raw_data first.

async function syncKtoNationwide() {
    console.log('🚀 Starting Nationwide KTO Official Popularity Sync (High-Velocity Alt)...');
    
    // 1. Get all unique sigungus in master_places
    const { data: locs, error: locError } = await supabase
        .from('master_places')
        .select('sido, sigungu, lDongSignguCd:raw_data->>lDongSignguCd')
        .not('raw_data->>lDongSignguCd', 'is', null);

    if (locError) {
        console.error('❌ Failed to fetch locations:', locError.message);
        return;
    }

    // Deduplicate
    const uniqueLocs = [];
    const seen = new Set();
    locs.forEach(l => {
        const key = `${l.sido}|${l.sigungu}`;
        if (!seen.has(key)) {
            uniqueLocs.push(l);
            seen.add(key);
        }
    });

    console.log(`- Total Unique Sigungus: ${uniqueLocs.length}`);

    let successCount = 0;
    
    for (const loc of uniqueLocs) {
        const areaCd = REGN_MAP[loc.sido];
        const rawCode = String(loc.lDongSignguCd || '');
        
        // Normalize to 5-digit Sigungu Code
        let signguCd = rawCode;
        if (rawCode.length < 5 && areaCd) {
            signguCd = areaCd + rawCode.padStart(3, '0');
        } else if (rawCode.length > 5) {
            signguCd = rawCode.substring(0, 5);
        }
        
        if (!areaCd || !signguCd || signguCd.length !== 5) {
            console.log(`- Skipping: ${loc.sido} ${loc.sigungu} (Invalid Code: ${signguCd})`);
            continue;
        }

        try {
            process.stdout.write(`- Processing: ${loc.sido} ${loc.sigungu} (${signguCd})... `);
            const params = new URLSearchParams({
                serviceKey: PUBLIC_API_KEY,
                numOfRows: '100',
                pageNo: '1',
                MobileOS: 'ETC',
                MobileApp: 'RAONAI',
                _type: 'json',
                baseYm: '202504',
                areaCd: areaCd,
                signguCd: signguCd
            });

            const res = await fetch(`http://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?${params.toString()}`);
            const data = await res.json();
            const items = data.response?.body?.items?.item || [];

            if (items.length > 0) {
                // Batch update
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const contentId = String(item.contentId);
                    const rank = i + 1;

                    await supabase.rpc('patch_place_raw_data_by_contentid', {
                        p_contentid: contentId,
                        p_patch: { kto_official: { rank, updated_at: new Date().toISOString(), source: 'KTO_NATIONWIDE_RECOVERY' } }
                    });
                }
                console.log(`✅ ${items.length} items updated.`);
                successCount++;
            } else {
                console.log('⚠️ No data found (Check mapping).');
            }
        } catch (e) {
            console.log(`❌ Error: ${e.message}`);
        }
        
        await new Promise(r => setTimeout(r, 100)); // Throttling
    }

    console.log(`\n🏁 Nationwide KTO Sync Completed. (Success: ${successCount}/${uniqueLocs.length})`);
}

syncKtoNationwide().catch(console.error);
