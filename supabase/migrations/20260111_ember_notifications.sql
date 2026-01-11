-- 불씨 알림 시스템 확장 마이그레이션
-- Phase 8.7: Ember Notification & Stats

-- =============================================
-- 1. send_ember RPC 수정 - 알림 생성 연동
-- =============================================
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

    -- 7. 수신자에게 인앱 배지 생성 (익명 알림)
    INSERT INTO in_app_badges (user_id, badge_target, event_type, title, body, related_id, is_read)
    VALUES (
        p_receiver_id, 
        'myspace', 
        'ember_received', 
        '🔥 따뜻한 불씨',
        '누군가 당신의 기록에 불씨를 남겼어요.',
        v_ember_id::TEXT,
        false
    );

    RETURN json_build_object(
        'success', true,
        'ember_id', v_ember_id,
        'tokens_spent', v_ember_cost,
        'remaining_tokens', v_current_token - v_ember_cost
    );
END;
$$;

-- =============================================
-- 2. 마이페이지 통계 RPC 함수
-- =============================================

-- 2.1 받은 불씨 통계 조회 (본인만 조회 가능)
CREATE OR REPLACE FUNCTION get_my_ember_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_user_id UUID;
    v_received_count INTEGER;
    v_sent_count INTEGER;
    v_total_spent INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', '로그인이 필요합니다.');
    END IF;

    -- 받은 불씨 수
    SELECT COUNT(*) INTO v_received_count
    FROM ember_supports
    WHERE receiver_id = v_user_id;

    -- 보낸 불씨 수
    SELECT COUNT(*) INTO v_sent_count
    FROM ember_supports
    WHERE sender_id = v_user_id;

    -- 총 소비 토큰 (보낸 불씨 x 10)
    v_total_spent := v_sent_count * 10;

    RETURN json_build_object(
        'success', true,
        'received_count', v_received_count,
        'sent_count', v_sent_count,
        'total_tokens_spent', v_total_spent
    );
END;
$$;

-- 2.2 보낸 불씨 내역 조회
CREATE OR REPLACE FUNCTION get_sent_embers(
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_user_id UUID;
    v_embers JSON;
    v_total INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', '로그인이 필요합니다.');
    END IF;

    -- 총 개수
    SELECT COUNT(*) INTO v_total
    FROM ember_supports
    WHERE sender_id = v_user_id;

    -- 불씨 내역 조회
    SELECT json_agg(ember_row) INTO v_embers
    FROM (
        SELECT 
            e.id,
            e.target_type,
            e.target_id,
            e.created_at,
            p.nickname as receiver_nickname,
            p.avatar_url as receiver_avatar
        FROM ember_supports e
        LEFT JOIN profiles p ON e.receiver_id = p.id
        WHERE e.sender_id = v_user_id
        ORDER BY e.created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    ) ember_row;

    RETURN json_build_object(
        'success', true,
        'embers', COALESCE(v_embers, '[]'::json),
        'total', v_total,
        'limit', p_limit,
        'offset', p_offset
    );
END;
$$;

-- 2.3 받은 불씨 내역 조회 (본인만)
CREATE OR REPLACE FUNCTION get_received_embers(
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_user_id UUID;
    v_embers JSON;
    v_total INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', '로그인이 필요합니다.');
    END IF;

    -- 총 개수
    SELECT COUNT(*) INTO v_total
    FROM ember_supports
    WHERE receiver_id = v_user_id;

    -- 받은 불씨 내역 (익명이므로 보낸 사람 정보 숨김)
    SELECT json_agg(ember_row) INTO v_embers
    FROM (
        SELECT 
            e.id,
            e.target_type,
            e.target_id,
            e.created_at
            -- 발신자 정보는 노출하지 않음 (익명성 보장)
        FROM ember_supports e
        WHERE e.receiver_id = v_user_id
        ORDER BY e.created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    ) ember_row;

    RETURN json_build_object(
        'success', true,
        'embers', COALESCE(v_embers, '[]'::json),
        'total', v_total,
        'limit', p_limit,
        'offset', p_offset
    );
END;
$$;
