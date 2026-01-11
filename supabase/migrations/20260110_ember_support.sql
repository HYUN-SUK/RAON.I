-- 불씨 남기기 (Token Ember Support) 마이그레이션
-- Fire Ember Support System Migration
-- Supports: Mission Participations, Community Posts, Comments

-- 1. ember_supports 테이블 생성 (다양한 대상 지원)
CREATE TABLE IF NOT EXISTS ember_supports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    -- 대상 유형: 'mission', 'post', 'comment'
    target_type TEXT NOT NULL DEFAULT 'mission',
    -- 대상 ID (user_mission_id, post_id, or comment_id)
    target_id UUID NOT NULL,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ember_sender ON ember_supports(sender_id);
CREATE INDEX IF NOT EXISTS idx_ember_receiver ON ember_supports(receiver_id);
CREATE INDEX IF NOT EXISTS idx_ember_target ON ember_supports(target_type, target_id);

-- RLS
ALTER TABLE ember_supports ENABLE ROW LEVEL SECURITY;

-- 모든 인증 사용자가 조회 가능
DROP POLICY IF EXISTS "Authenticated can view embers" ON ember_supports;
CREATE POLICY "Authenticated can view embers" ON ember_supports
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- 본인만 삽입 가능
DROP POLICY IF EXISTS "Users can send embers" ON ember_supports;
CREATE POLICY "Users can send embers" ON ember_supports
    FOR INSERT WITH CHECK (sender_id = auth.uid());

-- 2. send_ember RPC 함수 (범용 - 미션/게시물/댓글 지원)
CREATE OR REPLACE FUNCTION send_ember(
    p_receiver_id UUID,
    p_target_id UUID,
    p_target_type TEXT DEFAULT 'mission',
    p_message TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sender_id UUID;
    v_current_token INTEGER;
    v_ember_cost INTEGER := 10;
    v_ember_id UUID;
BEGIN
    -- 1. 발신자 확인
    v_sender_id := auth.uid();
    IF v_sender_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', '로그인이 필요합니다.');
    END IF;

    -- 2. 자기 자신에게 불씨 못 보냄
    IF v_sender_id = p_receiver_id THEN
        RETURN json_build_object('success', false, 'error', '본인에게는 불씨를 보낼 수 없습니다.');
    END IF;

    -- 3. 토큰 잔액 확인
    SELECT COALESCE(raon_token, 0) INTO v_current_token
    FROM profiles
    WHERE id = v_sender_id;

    IF v_current_token < v_ember_cost THEN
        RETURN json_build_object(
            'success', false, 
            'error', '토큰이 부족합니다.',
            'required', v_ember_cost,
            'current', v_current_token
        );
    END IF;

    -- 4. 토큰 차감
    UPDATE profiles
    SET raon_token = raon_token - v_ember_cost
    WHERE id = v_sender_id;

    -- 5. 불씨 기록 생성
    INSERT INTO ember_supports (sender_id, receiver_id, target_type, target_id, message)
    VALUES (v_sender_id, p_receiver_id, p_target_type, p_target_id, p_message)
    RETURNING id INTO v_ember_id;

    -- 6. 포인트 기록 (소모)
    INSERT INTO point_history (user_id, type, xp_delta, token_delta, gold_delta, reason, related_id)
    VALUES (v_sender_id, 'EMBER_SENT', 0, -v_ember_cost, 0, '불씨 응원 전송 (' || p_target_type || ')', v_ember_id::TEXT);

    RETURN json_build_object(
        'success', true,
        'ember_id', v_ember_id,
        'tokens_spent', v_ember_cost,
        'remaining_tokens', v_current_token - v_ember_cost
    );
END;
$$;

-- 3. 프로필에 받은 불씨 수 조회 함수
CREATE OR REPLACE FUNCTION get_ember_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
    SELECT COUNT(*)::INTEGER FROM ember_supports WHERE receiver_id = p_user_id;
$$;

-- 4. 특정 대상에 대한 불씨 수 조회 (범용)
CREATE OR REPLACE FUNCTION get_target_ember_count(p_target_type TEXT, p_target_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
    SELECT COUNT(*)::INTEGER FROM ember_supports 
    WHERE target_type = p_target_type AND target_id = p_target_id;
$$;
