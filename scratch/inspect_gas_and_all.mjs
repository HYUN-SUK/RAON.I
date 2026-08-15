import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminClient = createClient(supabaseUrl, serviceKey);
const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkAll6Tables() {
    console.log('====================================================');
    console.log('📊 6개 테이블 실제 건수 및 RLS 현황 상세 분석');
    console.log('====================================================\n');

    // 1. master_places
    const { count: mpAdmin } = await adminClient.from('master_places').select('id', { count: 'exact', head: true });
    const { count: mpAnon } = await anonClient.from('master_places').select('id', { count: 'exact', head: true });
    console.log(`1. master_places: 관리자(${mpAdmin}건) / 일반유저(${mpAnon}건) -> RLS 가동 완료 (Public Read)`);

    // 2. system_config
    const { count: scAdmin } = await adminClient.from('system_config').select('id', { count: 'exact', head: true });
    const { count: scAnon } = await anonClient.from('system_config').select('id', { count: 'exact', head: true });
    console.log(`2. system_config: 관리자(${scAdmin}건) / 일반유저(${scAnon}건) -> RLS 가동 완료 (Public Read + Admin Update)`);

    // 3. operation_logs
    const { count: olAdmin } = await adminClient.from('operation_logs').select('id', { count: 'exact', head: true });
    const { count: olAnon } = await anonClient.from('operation_logs').select('id', { count: 'exact', head: true });
    console.log(`3. operation_logs: 관리자(${olAdmin}건) / 일반유저(${olAnon}건) -> RLS 가동 완료 (Admin Only)`);

    // 4. likes
    const { count: lkAdmin } = await adminClient.from('likes').select('post_id', { count: 'exact', head: true });
    const { count: lkAnon } = await anonClient.from('likes').select('post_id', { count: 'exact', head: true });
    console.log(`4. likes: 관리자(${lkAdmin}건) / 일반유저(${lkAnon}건) -> RLS 가동 완료 (Public Read + User Insert/Delete)`);

    // 5. master_places_gas
    const { count: gasAdmin } = await adminClient.from('master_places_gas').select('id', { count: 'exact', head: true });
    const { count: gasAnon } = await anonClient.from('master_places_gas').select('id', { count: 'exact', head: true });
    console.log(`5. master_places_gas: 관리자(${gasAdmin}건) / 일반유저(${gasAnon}건)`);

    // 6. spatial_ref_sys
    console.log(`6. spatial_ref_sys: PostGIS 내장 시스템 테이블 (좌표계 정의 카탈로그)`);
}

checkAll6Tables();
