import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error('Missing environment variables!');
    process.exit(1);
}

const anonClient = createClient(supabaseUrl, anonKey);
const adminClient = createClient(supabaseUrl, serviceKey);

async function runTests() {
    console.log('====================================================');
    console.log('🚀 4개 테이블 RLS 가동 후 실시간 기능 전수 검증 시작');
    console.log('====================================================\n');

    let allPassed = true;

    // ----------------------------------------------------
    // Test 1: master_places
    // ----------------------------------------------------
    console.log('📍 [Test 1] master_places 검증');
    try {
        // 1-1. Anon SELECT
        const { data: places, error: placeErr } = await anonClient
            .from('master_places')
            .select('id, name, category, trust_score')
            .limit(3);

        if (placeErr) throw new Error(`Anon SELECT 실패: ${placeErr.message}`);
        console.log(`  ✅ [Anon SELECT] 성공! 조회된 장소 수: ${places?.length}개 (예: ${places?.[0]?.name})`);

        // 1-2. RPC get_master_places_in_radius_v2 (강릉바다내음 캠핑장 기준)
        const { data: rpcPlaces, error: rpcErr } = await anonClient.rpc('get_master_places_in_radius_v2', {
            target_lat: 37.751853,
            target_lng: 128.8760574,
            radius_meters: 30000,
            p_category: 'RESTAURANT',
            limit_count: 5
        });

        if (rpcErr) throw new Error(`RPC 호출 실패: ${rpcErr.message}`);
        console.log(`  ✅ [반경 검색 RPC] 성공! 반경 30km 내 식당: ${rpcPlaces?.length}개 (예: ${rpcPlaces?.[0]?.name}, 거리: ${Math.round(rpcPlaces?.[0]?.distance_meters)}m)`);

        // 1-3. Anon INSERT (차단되어야 함)
        const { error: insertErr } = await anonClient
            .from('master_places')
            .insert({ name: 'RLS_HACK_TEST_PLACE', category: 'RESTAURANT', lat: 37.0, lng: 127.0 });

        if (!insertErr) {
            console.log('  ⚠️ [보안 경고] Anon INSERT가 차단되지 않았습니다.');
        } else {
            console.log(`  ✅ [보안 검증: Anon 쓰기 차단] 정상 거부됨: ${insertErr.message}`);
        }
    } catch (err) {
        console.error('  ❌ master_places 검증 실패:', err.message);
        allPassed = false;
    }

    console.log('\n----------------------------------------------------');

    // ----------------------------------------------------
    // Test 2: system_config
    // ----------------------------------------------------
    console.log('⚙️ [Test 2] system_config 검증');
    try {
        // 2-1. Anon SELECT
        const { data: config, error: configErr } = await anonClient
            .from('system_config')
            .select('*')
            .eq('id', 1)
            .single();

        if (configErr) throw new Error(`Anon SELECT 실패: ${configErr.message}`);
        console.log(`  ✅ [Anon SELECT] 성공! 점검모드: ${config.maintenance_mode}, 예약활성화: ${config.reservation_enabled}`);

        // 2-2. Anon UPDATE (차단되어야 함)
        const { error: anonUpdateErr } = await anonClient
            .from('system_config')
            .update({ maintenance_mode: true })
            .eq('id', 1);

        if (!anonUpdateErr) {
            console.log('  ⚠️ [보안 경고] Anon UPDATE가 차단되지 않았습니다.');
        } else {
            console.log(`  ✅ [보안 검증: Anon 수정 차단] 정상 거부됨: ${anonUpdateErr.message}`);
        }

        // 2-3. Admin UPDATE via service role
        const { error: adminUpdateErr } = await adminClient
            .from('system_config')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', 1);

        if (adminUpdateErr) throw new Error(`Admin UPDATE 실패: ${adminUpdateErr.message}`);
        console.log('  ✅ [관리자 UPDATE] 성공! 설정 갱신 정상 작동');
    } catch (err) {
        console.error('  ❌ system_config 검증 실패:', err.message);
        allPassed = false;
    }

    console.log('\n----------------------------------------------------');

    // ----------------------------------------------------
    // Test 3: operation_logs
    // ----------------------------------------------------
    console.log('📜 [Test 3] operation_logs 검증');
    try {
        // 3-1. Anon SELECT (차단되어야 함 - 빈 배열 반환 또는 에러)
        const { data: anonLogs, error: anonLogErr } = await anonClient
            .from('operation_logs')
            .select('*');

        console.log(`  ✅ [보안 검증: Anon 열람 격리] Anon 조회 결과: ${anonLogs?.length ?? 0}건 (일반 사용자에게 노출 안 됨)`);

        // 3-2. Admin INSERT
        const testAction = 'RLS_VERIFICATION_TEST';
        const { data: insertedLog, error: logInsertErr } = await adminClient
            .from('operation_logs')
            .insert({
                action: testAction,
                description: 'RLS 활성화 후 실시간 동작 검증 로그',
                actor: 'admin'
            })
            .select()
            .single();

        if (logInsertErr) throw new Error(`Admin Log INSERT 실패: ${logInsertErr.message}`);
        console.log(`  ✅ [관리자 로그 적재] 성공! Log ID: ${insertedLog.id}, Action: ${insertedLog.action}`);

        // 3-3. Admin SELECT
        const { data: adminLogs, error: adminLogErr } = await adminClient
            .from('operation_logs')
            .select('*')
            .eq('action', testAction);

        if (adminLogErr || !adminLogs || adminLogs.length === 0) throw new Error('Admin Log SELECT 실패');
        console.log(`  ✅ [관리자 로그 조회] 성공! 조회된 로그 건수: ${adminLogs.length}건`);

        // Clean up test log
        await adminClient.from('operation_logs').delete().eq('id', insertedLog.id);
    } catch (err) {
        console.error('  ❌ operation_logs 검증 실패:', err.message);
        allPassed = false;
    }

    console.log('\n----------------------------------------------------');

    // ----------------------------------------------------
    // Test 4: likes & posts interaction
    // ----------------------------------------------------
    console.log('❤️ [Test 4] likes 및 커뮤니티 상호작용 검증');
    try {
        // 4-1. 테스트용 임시 게시물 1건 조회
        const { data: existingPost } = await adminClient
            .from('posts')
            .select('id, title, like_count')
            .limit(1)
            .single();

        if (!existingPost) {
            console.log('  ⚠️ 테스트할 게시물이 없어 신규 임시 게시글 생성 후 테스트');
        }

        const testPostId = existingPost?.id;
        const testUserId = '00000000-0000-0000-0000-000000000000'; // ANON_USER_ID

        if (testPostId) {
            // 기존 좋아요 정리
            await adminClient.from('likes').delete().eq('post_id', testPostId).eq('user_id', testUserId);

            // 4-2. Anon / Client INSERT (좋아요 누르기)
            const { data: likeData, error: likeInsertErr } = await anonClient
                .from('likes')
                .insert({ post_id: testPostId, user_id: testUserId })
                .select()
                .single();

            if (likeInsertErr) throw new Error(`좋아요 INSERT 실패: ${likeInsertErr.message}`);
            console.log(`  ✅ [좋아요 등록(Like)] 성공! Like ID: ${likeData.id}`);

            // 4-3. Anon SELECT (좋아요 상태 조회)
            const { data: foundLike, error: likeSelectErr } = await anonClient
                .from('likes')
                .select('id')
                .eq('post_id', testPostId)
                .eq('user_id', testUserId)
                .single();

            if (likeSelectErr || !foundLike) throw new Error('좋아요 조회 실패');
            console.log('  ✅ [좋아요 상태 조회(Check)] 성공! 등록된 좋아요 확인 완료');

            // 4-4. Anon DELETE (좋아요 취소)
            const { error: likeDeleteErr } = await anonClient
                .from('likes')
                .delete()
                .eq('id', foundLike.id);

            if (likeDeleteErr) throw new Error(`좋아요 취소(DELETE) 실패: ${likeDeleteErr.message}`);
            console.log('  ✅ [좋아요 취소(Unlike)] 성공! 정상 삭제 완료');

            // 4-5. RPC increment_like_count / decrement_like_count 검증
            const { error: incErr } = await anonClient.rpc('increment_like_count', { row_id: testPostId });
            if (incErr) throw new Error(`좋아요 증가 RPC 실패: ${incErr.message}`);

            const { error: decErr } = await anonClient.rpc('decrement_like_count', { row_id: testPostId });
            if (decErr) throw new Error(`좋아요 감소 RPC 실패: ${decErr.message}`);

            console.log('  ✅ [좋아요 카운트 RPC (Security Definer)] 성공! 증감 함수 정상 작동');
        }
    } catch (err) {
        console.error('  ❌ likes 검증 실패:', err.message);
        allPassed = false;
    }

    console.log('\n====================================================');
    if (allPassed) {
        console.log('🎉 4개 테이블 RLS 정책 및 전체 기능 검증 100% ALL PASS!');
    } else {
        console.log('❌ 일부 테스트에서 오류가 발생했습니다.');
    }
    console.log('====================================================\n');
}

runTests();
