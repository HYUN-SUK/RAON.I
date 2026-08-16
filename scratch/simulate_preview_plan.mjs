import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function simulatePreviewPlan() {
    const lat = 35.1609477290535;
    const lng = 129.167194019805;

    console.log(`--- 해운대센트럴호텔 (${lat}, ${lng}) 맛보기 시뮬레이션 ---`);

    // 1. RESTAURANT RPC 조회
    const { data: rawRestaurants, error: restErr } = await supabase.rpc('get_master_places_in_radius_v2', {
        target_lat: lat,
        target_lng: lng,
        radius_meters: 20000,
        limit_count: 300,
        p_category: 'RESTAURANT'
    });

    console.log(`1. RESTAURANT RPC 조회 결과: ${rawRestaurants?.length}건 (에러: ${restErr?.message || 'none'})`);

    if (!rawRestaurants || rawRestaurants.length === 0) {
        console.log('❌ 식당 데이터가 RPC에서 0건 반환됨!');
        return;
    }

    // 2. Blacklist 및 Filter 점검
    const globalBlacklist = /정비|카센터|공업사|세차|타이어|배터리|공인중개사|부동산|장례|상조|종교|교회|사찰$|센터$|학원|관리소|사무소|지물포|건재|상사|유통|공구|이발|미용|세탁|철물|사진관|인쇄소|스튜디오|모텔|여관|호텔|약국|디지털|분재|연구소|양복|안경|서점|서적/;

    const filtered = rawRestaurants.filter(r => {
        const name = r.name || '';
        const isBlack = globalBlacklist.test(name);
        return !isBlack;
    });

    console.log(`2. Blacklist 통과 식당: ${filtered.length} / ${rawRestaurants.length}건`);
    console.log(`   - 상위 10개 통과 식당 샘플:`);
    filtered.slice(0, 10).forEach(r => {
        console.log(`     * ${r.name} (Source: ${r.api_source}, quality: ${r.quality_score}, lat: ${r.lat}, lng: ${r.lng})`);
    });
}

simulatePreviewPlan();
