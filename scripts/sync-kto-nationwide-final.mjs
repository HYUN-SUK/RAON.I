import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;

/**
 * [v12.1] KTO 가용 데이터 월(baseYm) 자동 검색 헬퍼
 * 공공데이터 시차(보통 1~2개월)를 고려하여 최신 데이터를 찾습니다.
 */
async function getLatestValidBaseYm() {
    const now = new Date();
    // 최근 4개월치 시도
    for (let i = 1; i <= 4; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const yyyymm = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0');
        
        console.log(`🔍 Checking KTO availability for ${yyyymm}...`);
        const params = new URLSearchParams({
            serviceKey: PUBLIC_API_KEY,
            numOfRows: '1', pageNo: '1', MobileOS: 'ETC', MobileApp: 'RAONAI', _type: 'json',
            baseYm: yyyymm, areaCd: '1', signguCd: '110' // 서울 종로구 샘플
        });
        
        try {
            const res = await fetch(`https://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?${params.toString()}`);
            const data = await res.json();
            if (data.response?.body?.totalCount > 0) {
                console.log(`✅ Found valid KTO data month: ${yyyymm}`);
                return yyyymm;
            }
        } catch (e) {}
    }
    return '202412'; // Fallback
}

async function syncKtoNationwideFinal() {
    console.log('🚀 [KTO Global Sync] Starting High-Integrity Nationwide Sync...');

    const validBaseYm = await getLatestValidBaseYm();
    console.log(`📅 Target Data Month: ${validBaseYm}`);

    // 1. Fully Robust Unique Region Fetch
    const { data: regions, error } = await supabase
        .from('master_places')
        .select('sido, sigungu, areaCode:raw_data->>areaCode, sigunguCode:raw_data->>sigunguCode')
        .not('raw_data->>areaCode', 'is', null)
        .limit(3000); 
            
    const seen = new Set();
    const finalRegionMap = regions?.filter(r => {
        const key = `${r.sido}|${r.sigungu}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }) || [];

    if (!finalRegionMap || finalRegionMap.length === 0) {
        console.error('❌ Critical: Failed to detect any KTO regions.');
        return;
    }

    console.log(`- Detected ${finalRegionMap.length} Unique KTO-standard Regions.`);

    let successCount = 0;
    for (const reg of finalRegionMap) {
        try {
            process.stdout.write(`- [${reg.sido} ${reg.sigungu}] Syncing... `);
            
            const params = new URLSearchParams({
                serviceKey: PUBLIC_API_KEY,
                numOfRows: '100', pageNo: '1', MobileOS: 'ETC', MobileApp: 'RAONAI', _type: 'json',
                baseYm: validBaseYm,
                areaCd: reg.areaCode,
                signguCd: reg.sigunguCode
            });

            const url = `https://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?${params.toString()}`;
            const res = await fetch(url);
            const data = await res.json();
            const items = data.response?.body?.items?.item || [];

            if (items.length > 0) {
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const contentId = String(item.contentId);
                    const rank = i + 1;

                    await supabase.rpc('patch_place_raw_data_by_contentid', {
                        p_contentid: contentId,
                        p_patch: { 
                            kto_official: { 
                                rank, 
                                baseYm: validBaseYm,
                                updated_at: new Date().toISOString(), 
                                source: 'KTO_NATIONWIDE_V12.1' 
                            } 
                        }
                    });
                }
                console.log(`✅ ${items.length} updated.`);
                successCount++;
            } else {
                console.log('⚠️ Empty.');
            }
        } catch (e) {
            console.log(`❌ Error: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 100));
    }

    console.log(`\n🏁 [KTO Global Sync] Completed. Success: ${successCount}/${finalRegionMap.length}`);
}

syncKtoNationwideFinal().catch(console.error);
