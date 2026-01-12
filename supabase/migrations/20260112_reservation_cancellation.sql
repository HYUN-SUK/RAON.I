-- =====================================================
-- 예약 취소 및 환불 시스템
-- 2026-01-12
-- 
-- 목적: 사용자가 예약을 취소 요청하고, 관리자가 환불을 처리
-- 환불정책: D-7 100% ~ D-Day 0%
-- =====================================================

-- 1. reservations 테이블에 환불 관련 컬럼 추가
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS refund_bank TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS refund_account TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS refund_holder TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS refund_amount NUMERIC DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS refund_rate INT DEFAULT 0;

-- 2. status CHECK 제약 업데이트 (REFUND_PENDING 추가)
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_status_check;
ALTER TABLE reservations ADD CONSTRAINT reservations_status_check 
    CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'COMPLETED'));

-- 3. 환불율 계산 함수
CREATE OR REPLACE FUNCTION calculate_refund_rate(p_check_in_date DATE)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_days_until INT;
BEGIN
    v_days_until := p_check_in_date - CURRENT_DATE;
    
    -- 환불 정책
    -- 입실 당일(0), 1일전: 0%
    -- 입실 2일전: 20%
    -- 입실 3일전: 30%
    -- 입실 4일전: 40%
    -- 입실 5일전: 50%
    -- 입실 6일전: 90%
    -- 입실 7일전 이상: 100%
    
    IF v_days_until <= 1 THEN
        RETURN 0;
    ELSIF v_days_until = 2 THEN
        RETURN 20;
    ELSIF v_days_until = 3 THEN
        RETURN 30;
    ELSIF v_days_until = 4 THEN
        RETURN 40;
    ELSIF v_days_until = 5 THEN
        RETURN 50;
    ELSIF v_days_until = 6 THEN
        RETURN 90;
    ELSE
        RETURN 100;
    END IF;
END;
$$;

-- 4. 사용자가 본인 예약을 취소 요청하는 RPC
CREATE OR REPLACE FUNCTION request_reservation_cancel(
    p_reservation_id UUID,
    p_refund_bank TEXT,
    p_refund_account TEXT,
    p_refund_holder TEXT,
    p_cancel_reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_status TEXT;
    v_check_in DATE;
    v_total_price NUMERIC;
    v_refund_rate INT;
    v_refund_amount NUMERIC;
BEGIN
    -- 예약 정보 조회
    SELECT user_id, status, check_in_date, total_price
    INTO v_user_id, v_status, v_check_in, v_total_price
    FROM reservations
    WHERE id = p_reservation_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'NOT_FOUND',
            'message', '예약을 찾을 수 없습니다.'
        );
    END IF;
    
    -- 본인 예약 확인
    IF v_user_id != auth.uid() THEN
        RETURN json_build_object(
            'success', false,
            'error', 'UNAUTHORIZED',
            'message', '본인의 예약만 취소할 수 있습니다.'
        );
    END IF;
    
    -- 취소 가능 상태 확인 (PENDING 또는 CONFIRMED만 취소 가능)
    IF v_status NOT IN ('PENDING', 'CONFIRMED') THEN
        RETURN json_build_object(
            'success', false,
            'error', 'INVALID_STATUS',
            'message', '취소할 수 없는 예약 상태입니다.'
        );
    END IF;
    
    -- 환불율 계산
    v_refund_rate := calculate_refund_rate(v_check_in);
    v_refund_amount := ROUND(v_total_price * v_refund_rate / 100);
    
    -- 예약 상태 업데이트
    UPDATE reservations
    SET 
        status = 'REFUND_PENDING',
        refund_bank = p_refund_bank,
        refund_account = p_refund_account,
        refund_holder = p_refund_holder,
        cancel_reason = p_cancel_reason,
        refund_rate = v_refund_rate,
        refund_amount = v_refund_amount,
        cancelled_at = NOW(),
        updated_at = NOW()
    WHERE id = p_reservation_id;
    
    RETURN json_build_object(
        'success', true,
        'refund_rate', v_refund_rate,
        'refund_amount', v_refund_amount,
        'message', '취소 요청이 완료되었습니다. 환불은 확인 후 처리됩니다.'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', 'DB_ERROR',
        'message', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION request_reservation_cancel(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 5. 관리자가 환불 완료 처리하는 RPC
CREATE OR REPLACE FUNCTION complete_reservation_refund(p_reservation_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_status TEXT;
    v_email TEXT;
BEGIN
    -- 관리자 권한 확인
    v_email := auth.jwt() ->> 'email';
    IF v_email != 'admin@raon.ai' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'UNAUTHORIZED',
            'message', '관리자 권한이 필요합니다.'
        );
    END IF;
    
    -- 예약 상태 확인
    SELECT status INTO v_status FROM reservations WHERE id = p_reservation_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'NOT_FOUND',
            'message', '예약을 찾을 수 없습니다.'
        );
    END IF;
    
    IF v_status != 'REFUND_PENDING' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'INVALID_STATUS',
            'message', '환불대기 상태의 예약만 처리할 수 있습니다.'
        );
    END IF;
    
    -- 환불 완료 처리
    UPDATE reservations
    SET 
        status = 'REFUNDED',
        refunded_at = NOW(),
        updated_at = NOW()
    WHERE id = p_reservation_id;
    
    RETURN json_build_object(
        'success', true,
        'message', '환불이 완료 처리되었습니다.'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', 'DB_ERROR',
        'message', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION complete_reservation_refund(UUID) TO authenticated;

-- 6. 사용자 본인 예약 목록 조회 RPC
CREATE OR REPLACE FUNCTION get_my_reservations()
RETURNS SETOF reservations
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM reservations
    WHERE user_id = auth.uid()
    ORDER BY created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_reservations() TO authenticated;

-- 7. RLS 정책 업데이트: 사용자가 본인 예약을 취소 요청할 수 있도록
DROP POLICY IF EXISTS "Users can update own reservation for cancel" ON reservations;
CREATE POLICY "Users can update own reservation for cancel" ON reservations
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE 'Reservation cancellation system installed successfully';
    RAISE NOTICE '  - calculate_refund_rate: Refund rate calculation';
    RAISE NOTICE '  - request_reservation_cancel: User cancel request';
    RAISE NOTICE '  - complete_reservation_refund: Admin refund completion';
    RAISE NOTICE '  - get_my_reservations: User reservation list';
END $$;
