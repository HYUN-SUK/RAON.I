import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;

async function syncKtoNationwideFinal() {
    console.log('🚀 [KTO Global Sync] Starting High-Integrity Nationwide Sync...');

    // 1. Fully Robust Unique Region Fetch
    const { data, error } = await supabase
        .from('master_places')
        .select('sido, sigungu, areaCode:raw_data->>areaCode, sigunguCode:raw_data->>sigunguCode')
        .not('raw_data->>areaCode', 'is', null) // Primary filter: Must have KTO AreaCode
        .limit(2000); // Plenty for 250 sigungus
            
    // Client-side deduplication (SOP v11.3 Standard)
    const seen = new Set();
    const finalRegionMap = data?.filter(r => {
        const key = `${r.sido}|${r.sigungu}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }) || [];

    if (!finalRegionMap || finalRegionMap.length === 0) {
        console.error('❌ Critical: Failed to detect any KTO regions. Verify database content.');
        return;
    }

    console.log(`- Detected ${finalRegionMap.length} Unique KTO-standard Regions.`);

    let successCount = 0;
    for (const reg of finalRegionMap) {
        try {
            process.stdout.write(`- Processing: ${reg.sido} ${reg.sigungu} (${reg.areaCode}/${reg.sigunguCode})... `);
            
            const params = new URLSearchParams({
                serviceKey: PUBLIC_API_KEY,
                numOfRows: '100',
                pageNo: '1',
                MobileOS: 'ETC',
                MobileApp: 'RAONAI',
                _type: 'json',
                baseYm: '202504',
                areaCd: reg.areaCode,
                signguCd: reg.sigunguCode
            });

            const url = `http://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?${params.toString()}`;
            const res = await fetch(url);
            const data = await res.json();
            const items = data.response?.body?.items?.item || [];

            if (items.length > 0) {
                // Bulk update via RPC
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const contentId = String(item.contentId);
                    const rank = i + 1;

                    await supabase.rpc('patch_place_raw_data_by_contentid', {
                        p_contentid: contentId,
                        p_patch: { kto_official: { rank, updated_at: new Date().toISOString(), source: 'KTO_NATIONWIDE_FINAL' } }
                    });
                }
                console.log(`✅ ${items.length} items updated.`);
                successCount++;
            } else {
                console.log('⚠️ No data found (KTO source empty).');
            }
        } catch (e) {
            console.log(`❌ Error: ${e.message}`);
        }
        
        await new Promise(r => setTimeout(r, 100)); // Throttling
    }

    console.log(`\n🏁 [KTO Global Sync] Completed. Success: ${successCount}/${regionMap.length}`);
}

syncKtoNationwideFinal().catch(console.error);
