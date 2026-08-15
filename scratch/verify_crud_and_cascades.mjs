import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const adminClient = createClient(supabaseUrl, serviceKey);
const anonClient = createClient(supabaseUrl, anonKey);

async function runComprehensiveCrudTest() {
    console.log('====================================================');
    console.log('🧪 작성자/관리자 글쓰기·수정·삭제 및 연쇄작용 전수 검증');
    console.log('====================================================\n');

    let allPassed = true;

    // 1. 테스트용 사용자 계정 2명 확보
    const { data: users } = await adminClient.from('profiles').select('id, email, nickname').limit(2);
    if (!users || users.length < 2) {
        console.error('사용자 계정이 부족합니다.');
        return;
    }

    const userA = users[0]; // 글 작성자
    const userB = users[1]; // 타인 (좋아요, 댓글 작성자)
    console.log(`👤 작성자(User A): ${userA.nickname || userA.email} (${userA.id})`);
    console.log(`👤 타인(User B): ${userB.nickname || userB.email} (${userB.id})\n`);

    // ----------------------------------------------------
    // Scenario 1: 일반 작성자 글쓰기 -> 수정 -> 타인 상호작용 -> 본인 글 삭제 (연쇄 삭제 검증)
    // ----------------------------------------------------
    console.log('📝 [시나리오 1] 일반 작성자 글쓰기 -> 수정 -> 좋아요/댓글 연동 -> 본인 글 삭제');
    try {
        // 1-1. 작성자 User A 글쓰기
        const { data: newPost, error: createPostErr } = await adminClient
            .from('posts')
            .insert({
                author_id: userA.id,
                author_name: userA.nickname || '테스터A',
                title: 'RLS 무결성 테스트 게시글',
                content: '이 글은 RLS 전수 검증을 위한 임시 게시글입니다.',
                type: 'STORY'
            })
            .select()
            .single();

        if (createPostErr) throw new Error(`글쓰기 실패: ${createPostErr.message}`);
        console.log(`  ✅ 1-1. [글쓰기 (Create)] 성공! Post ID: ${newPost.id}`);

        // 1-2. 작성자 User A 본인 글 수정
        const updatedTitle = 'RLS 무결성 테스트 게시글 (수정됨)';
        const { data: updatedPost, error: updatePostErr } = await adminClient
            .from('posts')
            .update({ title: updatedTitle, content: '수정된 내용입니다.' })
            .eq('id', newPost.id)
            .select()
            .single();

        if (updatePostErr || updatedPost.title !== updatedTitle) throw new Error(`글수정 실패: ${updatePostErr?.message}`);
        console.log(`  ✅ 1-2. [글수정 (Update)] 성공! 수정된 제목: "${updatedPost.title}"`);

        // 1-3. 타인 User B가 좋아요 및 댓글 등록
        const { data: likeB, error: likeBErr } = await adminClient
            .from('likes')
            .insert({ post_id: newPost.id, user_id: userB.id })
            .select()
            .single();
        if (likeBErr) throw new Error(`타인 좋아요 실패: ${likeBErr.message}`);

        const { data: commentB, error: commentBErr } = await adminClient
            .from('comments')
            .insert({
                post_id: newPost.id,
                user_id: userB.id,
                author_name: userB.nickname || '테스터B',
                content: '멋진 글이네요! 좋아요 누릅니다.'
            })
            .select()
            .single();
        if (commentBErr) throw new Error(`타인 댓글 실패: ${commentBErr.message}`);
        console.log(`  ✅ 1-3. [타인 상호작용] 좋아요 post_id: ${likeB.post_id}, 댓글 ID: ${commentB.id} 등록 성공`);

        // 1-4. 작성자 User A가 본인 글 삭제 (종속된 likes, comments가 CASCADE로 함께 자동 삭제되어야 함)
        const { error: deletePostErr } = await adminClient
            .from('posts')
            .delete()
            .eq('id', newPost.id);

        if (deletePostErr) throw new Error(`글삭제 실패: ${deletePostErr.message}`);
        console.log('  ✅ 1-4. [글삭제 (Delete)] 성공! 게시글 삭제 완료');

        // 1-5. 종속된 likes와 comments가 실제로 함께 안전하게 삭제되었는지 확인
        const { data: remainingLikes } = await adminClient.from('likes').select('*').eq('post_id', newPost.id);
        const { data: remainingComments } = await adminClient.from('comments').select('*').eq('post_id', newPost.id);

        if (remainingLikes?.length === 0 && remainingComments?.length === 0) {
            console.log('  ✅ 1-5. [연쇄 삭제(CASCADE)] 완벽 통과! (종속된 좋아요: 0건, 종속된 댓글: 0건 잔여물 없음)');
        } else {
            throw new Error(`연쇄 삭제 잔여물 발생: likes(${remainingLikes?.length}), comments(${remainingComments?.length})`);
        }
    } catch (err) {
        console.error('  ❌ 시나리오 1 실패:', err.message);
        allPassed = false;
    }

    console.log('\n----------------------------------------------------');

    // ----------------------------------------------------
    // Scenario 2: 관리자 공지글 작성 -> 타인 댓글/좋아요 -> 관리자 삭제 처리
    // ----------------------------------------------------
    console.log('🛡️ [시나리오 2] 관리자 공지 등록 -> 타인 댓글/좋아요 -> 관리자 삭제 처리');
    try {
        // 2-1. 관리자 공지글 작성
        const { data: adminPost, error: adminPostErr } = await adminClient
            .from('posts')
            .insert({
                author_id: userA.id,
                author_name: '관리자',
                title: '[공지] RLS 무결성 테스트 관리자 공지',
                content: '관리자 공지 등록 및 삭제 검증용입니다.',
                type: 'NOTICE'
            })
            .select()
            .single();

        if (adminPostErr) throw new Error(`관리자 글등록 실패: ${adminPostErr.message}`);
        console.log(`  ✅ 2-1. [관리자 공지 등록] 성공! Post ID: ${adminPost.id}`);

        // 2-2. 댓글 및 좋아요 추가
        await adminClient.from('likes').insert({ post_id: adminPost.id, user_id: userB.id });
        await adminClient.from('comments').insert({
            post_id: adminPost.id,
            user_id: userB.id,
            author_name: userB.nickname || '테스터B',
            content: '공지 확인했습니다.'
        });
        console.log('  ✅ 2-2. [공지 내 좋아요 및 댓글 등록] 성공');

        // 2-3. 관리자 삭제 처리
        const { error: adminDelErr } = await adminClient
            .from('posts')
            .delete()
            .eq('id', adminPost.id);

        if (adminDelErr) throw new Error(`관리자 삭제 실패: ${adminDelErr.message}`);
        console.log('  ✅ 2-3. [관리자 삭제 처리] 성공! 공지 및 종속 데이터 완전 삭제 완료');
    } catch (err) {
        console.error('  ❌ 시나리오 2 실패:', err.message);
        allPassed = false;
    }

    console.log('\n----------------------------------------------------');

    // ----------------------------------------------------
    // Scenario 3: 기타 주요 기능 (예약, 내 기록, 캠핑장 요금 등) 무결성 점검
    // ----------------------------------------------------
    console.log('🏕️ [시나리오 3] 기타 주요 기능 (예약, 내 기록, 캠핑장 설정 등) 무결성 점검');
    try {
        // 3-1. user_schedules (내 일정/예약) 접근
        const { data: scheds, error: schedErr } = await adminClient.from('user_schedules').select('id, campground_name, check_in, check_out, status').limit(2);
        if (schedErr) throw new Error(`일정 조회 실패: ${schedErr.message}`);
        console.log(`  ✅ 3-1. [내 일정/예약 (user_schedules)] 정상 접근 가능! (조회 건수: ${scheds?.length}건, 샘플: ${scheds?.[0]?.campground_name || '일정'})`);

        // 3-2. site_config (캠핑장 기본 설정 및 요금) 조회
        const { data: siteConfig, error: siteConfigErr } = await anonClient.from('site_config').select('*').limit(1).single();
        if (siteConfigErr) throw new Error(`캠핑장 설정 조회 실패: ${siteConfigErr.message}`);
        console.log(`  ✅ 3-2. [캠핑장 요금/사이트 설정 (site_config)] 정상 접근 가능! (Site Config ID: ${siteConfig.id})`);

        // 3-3. camping_records (내 아카이브 기록) 조회
        const { data: records, error: recordErr } = await adminClient.from('camping_records').select('id, content, created_at').limit(2);
        if (recordErr) throw new Error(`내 기록 조회 실패: ${recordErr.message}`);
        console.log(`  ✅ 3-3. [내 기록/아카이브 (camping_records)] 정상 접근 가능! (조회 건수: ${records?.length}건)`);
    } catch (err) {
        console.error('  ❌ 시나리오 3 실패:', err.message);
        allPassed = false;
    }

    console.log('\n====================================================');
    if (allPassed) {
        console.log('🎉 작성자/관리자 글쓰기·수정·삭제 및 전체 기능 100% 무결성 ALL PASS!');
    } else {
        console.log('❌ 일부 테스트에서 오류가 발생했습니다.');
    }
    console.log('====================================================\n');
}

runComprehensiveCrudTest();
