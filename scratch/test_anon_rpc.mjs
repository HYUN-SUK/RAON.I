import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const anonClient = createClient(supabaseUrl, anonKey);

async function testAnonRpc() {
    const lat = 35.1609477290535;
    const lng = 129.167194019805;

    console.log('--- Anon Client로 get_master_places_in_radius_v2 호출 테스트 ---');
    const start = Date.now();
    const { data: restData, error: restErr } = await anonClient.rpc('get_master_places_in_radius_v2', {
        target_lat: lat,
        target_lng: lng,
        radius_meters: 20000,
        limit_count: 300,
        p_category: 'RESTAURANT'
    });
    console.log(`RESTAURANT (${Date.now() - start}ms): 건수=${restData?.length}, 에러=${restErr?.message || 'none'}`);

    const { data: spotData, error: spotErr } = await anonClient.rpc('get_master_places_in_radius_v2', {
        target_lat: lat,
        target_lng: lng,
        radius_meters: 20000,
        limit_count: 300,
        p_category: 'SPOT'
    });
    console.log(`SPOT: 건수=${spotData?.length}, 에러=${spotErr?.message || 'none'}`);

    const { data: hospData, error: hospErr } = await anonClient.rpc('get_master_places_in_radius_v2', {
        target_lat: lat,
        target_lng: lng,
        radius_meters: 20000,
        limit_count: 100,
        p_category: 'HOSPITAL'
    });
    console.log(`HOSPITAL: 건수=${hospData?.length}, 에러=${hospErr?.message || 'none'}`);
}

testAnonRpc();
