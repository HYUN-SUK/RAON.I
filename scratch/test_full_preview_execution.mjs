import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// smartPlan.ts 내부의 generatePreviewSmartPlan을 시뮬레이션
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function testFullPreview() {
    const lat = 35.1609477290535;
    const lng = 129.167194019805;

    const [restRes, spotRes, hospRes] = await Promise.all([
        supabase.rpc('get_master_places_in_radius_v2', {
            target_lat: lat,
            target_lng: lng,
            radius_meters: 20000,
            limit_count: 300,
            p_category: 'RESTAURANT'
        }),
        supabase.rpc('get_master_places_in_radius_v2', {
            target_lat: lat,
            target_lng: lng,
            radius_meters: 20000,
            limit_count: 300,
            p_category: 'SPOT'
        }),
        supabase.rpc('get_master_places_in_radius_v2', {
            target_lat: lat,
            target_lng: lng,
            radius_meters: 20000,
            limit_count: 100,
            p_category: 'HOSPITAL'
        })
    ]);

    console.log(`Raw: rest=${restRes.data?.length}, spot=${spotRes.data?.length}, hosp=${hospRes.data?.length}`);

    // schedule 페이지에서 맛보기를 생성하는 API / 서버액션 추적
}

testFullPreview();
