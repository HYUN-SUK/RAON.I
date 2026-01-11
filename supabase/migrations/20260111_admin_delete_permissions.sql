-- =====================================================
-- 관리자 삭제 권한 설정
-- 2026-01-11
-- 
-- 1. 후기(posts) 삭제: admin_force_delete_post RPC
-- 2. 컨텐츠(creator_contents) 삭제: RLS 정책 추가
-- 3. 마켓(products) 삭제: RLS 정책 추가
-- =====================================================

-- ============================================
-- 1. 후기/게시물 관리자 강제 삭제 RPC
-- ============================================
-- 기존 함수 삭제 (반환 타입 변경 시 필요)
DROP FUNCTION IF EXISTS admin_force_delete_post(UUID);

CREATE OR REPLACE FUNCTION admin_force_delete_post(p_post_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_email TEXT;
BEGIN
    -- 관리자 권한 확인
    SELECT auth.jwt() ->> 'email' INTO v_user_email;
    
    IF v_user_email IS NULL OR v_user_email != 'admin@raon.ai' THEN
        RETURN json_build_object('success', false, 'error', '관리자 권한이 필요합니다.');
    END IF;
    
    -- 댓글 먼저 삭제 (FK 제약)
    DELETE FROM comments WHERE post_id = p_post_id;
    
    -- 좋아요 삭제 (테이블명: likes)
    DELETE FROM likes WHERE post_id = p_post_id;
    
    -- 게시물 삭제
    DELETE FROM posts WHERE id = p_post_id;
    
    RETURN json_build_object('success', true, 'message', '게시물이 삭제되었습니다.');
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_force_delete_post(UUID) TO authenticated;

-- ============================================
-- 2. 컨텐츠(creator_contents) 관리자 삭제 RPC
-- ============================================
DROP FUNCTION IF EXISTS admin_delete_creator_content(UUID);

CREATE OR REPLACE FUNCTION admin_delete_creator_content(p_content_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_email TEXT;
BEGIN
    SELECT auth.jwt() ->> 'email' INTO v_user_email;
    
    IF v_user_email IS NULL OR v_user_email != 'admin@raon.ai' THEN
        RETURN json_build_object('success', false, 'error', '관리자 권한이 필요합니다.');
    END IF;
    
    -- 관련 댓글 삭제
    DELETE FROM creator_content_comments WHERE content_id = p_content_id;
    
    -- 관련 좋아요 삭제
    DELETE FROM creator_content_likes WHERE content_id = p_content_id;
    
    -- 에피소드 삭제
    DELETE FROM creator_episodes WHERE content_id = p_content_id;
    
    -- 컨텐츠 삭제
    DELETE FROM creator_contents WHERE id = p_content_id;
    
    RETURN json_build_object('success', true, 'message', '콘텐츠가 삭제되었습니다.');
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_creator_content(UUID) TO authenticated;

-- ============================================
-- 3. 마켓 상품(products) RLS 정책
-- ============================================
-- 관리자 삭제/수정 허용
DO $$
BEGIN
    DROP POLICY IF EXISTS "Admin can manage products" ON products;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        CREATE POLICY "Admin can manage products" ON products
            FOR ALL USING (auth.jwt() ->> 'email' = 'admin@raon.ai');
    END IF;
END $$;

-- ============================================
-- 4. 콘텐츠 댓글(creator_content_comments) 삭제 RPC
-- ============================================
CREATE OR REPLACE FUNCTION admin_delete_creator_comment(p_comment_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_email TEXT;
BEGIN
    SELECT auth.jwt() ->> 'email' INTO v_user_email;
    
    IF v_user_email IS NULL OR v_user_email != 'admin@raon.ai' THEN
        RETURN json_build_object('success', false, 'error', '관리자 권한이 필요합니다.');
    END IF;
    
    DELETE FROM creator_content_comments WHERE id = p_comment_id;
    
    RETURN json_build_object('success', true, 'message', '댓글이 삭제되었습니다.');
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_creator_comment(UUID) TO authenticated;

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ 관리자 삭제 권한 설정 완료';
    RAISE NOTICE '  - admin_force_delete_post: 게시물 강제 삭제';
    RAISE NOTICE '  - admin_delete_creator_comment: 콘텐츠 댓글 삭제';
    RAISE NOTICE '  - RLS 정책: 관리자 컨텐츠/마켓 삭제 허용';
END $$;
