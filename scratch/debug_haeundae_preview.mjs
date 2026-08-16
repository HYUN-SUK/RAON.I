import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function debugHaeundae() {
    console.log('====================================================');
    console.log('🔍 해운대센트럴호텔 맛보기 식당 누락 원인 분석');
    console.log('====================================================\n');

    // 1. user_schedules에서 '해운대센트럴호텔' 일정 검색
    const { data: scheds } = await supabase
        .from('user_schedules')
        .select('*')
        .ilike('campground_name', '%해운대%')
        .limit(5);

    console.log(`1. '해운대' 관련 일정 검색 결과 (${scheds?.length}건):`);
    if (!scheds || scheds.length === 0) {
        console.log('   - DB에 해운대 일정이 직접 등록되어 있지 않음. 가상 좌표로 테스트.');
    } else {
        scheds.forEach(s => {
            console.log(`   - ID: ${s.id} / 이름: ${s.campground_name} / lat: ${s.campground_lat}, lng: ${s.campground_lng}`);
            console.log(`     smart_plan_data 존재 여부: ${!!s.smart_plan_data}, is_preview: ${s.smart_plan_data?.is_preview}`);
            if (s.smart_plan_data) {
                console.log(`     itemListElement categories:`, s.smart_plan_data.itemListElement?.map(c => `${c.name}(${c.category})`));
            }
        });
    }

    // 2. 해운대센트럴호텔 좌표 (부산 해운대구 구남로 29번길 28 / lat: 35.1608, lng: 129.1601)
    const lat = scheds?.[0]?.campground_lat || 35.1608;
    const lng = scheds?.[0]?.campground_lng || 129.1601;
    console.log(`\n2. 좌표 (${lat}, ${lng}) 기준 master_places 식당 RPC 조회:`);

    const { data: restData, error: restErr } = await supabase.rpc('get_master_places_in_radius_v2', {
        target_lat: lat,
        target_lng: lng,
        radius_meters: 20000,
        limit_count: 300,
        p_category: 'RESTAURANT'
    });

    console.log(`   - RESTAURANT 조회 건수: ${restData?.length || 0}건 (Error: ${restErr?.message || 'None'})`);
    if (restData && restData.length > 0) {
        console.log(`   - 상위 5개 식당:`, restData.slice(0, 5).map(r => `${r.name} (${r.api_source}, quality: ${r.quality_score})`));
    }

    // 3. SPOT 조회
    const { data: spotData, error: spotErr } = await supabase.rpc('get_master_places_in_radius_v2', {
        target_lat: lat,
        target_lng: lng,
        radius_meters: 20000,
        limit_count: 300,
        p_category: 'SPOT'
    });
    console.log(`   - SPOT 조회 건수: ${spotData?.length || 0}건 (Error: ${spotErr?.message || 'None'})`);
    if (spotData && spotData.length > 0) {
        console.log(`   - 상위 5개 명소:`, spotData.slice(0, 5).map(r => `${r.name} (${r.api_source}, trust: ${r.trust_score})`));
    }
}

debugHaeundae();
