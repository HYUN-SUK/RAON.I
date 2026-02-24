-- ========================================================================================
-- Smart Camping Plan Phase 1: Reservation Guest Details
-- ========================================================================================
-- 예약 시 성인/미취학/초등/청소년 인원을 세분화하여 수집하기 위한 스키마 및 RPC 변경

-- 1. reservations 테이블에 guest_details JSONB 컬럼 추가
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS guest_details JSONB;

-- 2. create_reservation_safe RPC 함수 업데이트 (p_guest_details 매개변수 추가)
DROP FUNCTION IF EXISTS create_reservation_safe(UUID, TEXT, DATE, DATE, INT, INT, INT, NUMERIC, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS create_reservation_safe(UUID, TEXT, DATE, DATE, INT, INT, INT, NUMERIC, TEXT, TEXT, TEXT, JSONB) CASCADE;

CREATE OR REPLACE FUNCTION create_reservation_safe(
    p_user_id UUID,
    p_site_id TEXT,
    p_check_in DATE,
    p_check_out DATE,
    p_family_count INT DEFAULT 1,
    p_visitor_count INT DEFAULT 0,
    p_vehicle_count INT DEFAULT 1,
    p_total_price NUMERIC DEFAULT 0,
    p_guest_name TEXT DEFAULT NULL,
    p_guest_phone TEXT DEFAULT NULL,
    p_requests TEXT DEFAULT NULL,
    p_guest_details JSONB DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lock_key BIGINT;
    v_existing_count INT;
    v_reservation_id UUID;
    v_nights INT;
BEGIN
    -- 1. Lock Key 생성
    v_lock_key := hashtext(p_site_id || p_check_in::TEXT);
    
    -- 2. Advisory Lock 획득
    IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'CONCURRENT_REQUEST',
            'message', '다른 예약이 처리 중입니다. 잠시 후 다시 시도해주세요.'
        );
    END IF;
    
    -- 3. 중복 예약 확인
    SELECT COUNT(*) INTO v_existing_count
    FROM reservations
    WHERE site_id = p_site_id
      AND status NOT IN ('CANCELLED', 'REFUNDED')
      AND check_in_date < p_check_out
      AND check_out_date > p_check_in;
    
    IF v_existing_count > 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'ALREADY_BOOKED',
            'message', '죄송합니다. 이미 예약이 완료된 날짜입니다.'
        );
    END IF;
    
    v_nights := p_check_out - p_check_in;
    
    -- 4. 예약 생성
    INSERT INTO reservations (
        id,
        user_id,
        site_id,
        check_in_date,
        check_out_date,
        nights,
        family_count,
        visitor_count,
        vehicle_count,
        total_price,
        guest_name,
        guest_phone,
        requests,
        guest_details,
        status,
        created_at
    ) VALUES (
        gen_random_uuid(),
        p_user_id,
        p_site_id,
        p_check_in,
        p_check_out,
        v_nights,
        p_family_count,
        p_visitor_count,
        p_vehicle_count,
        p_total_price,
        p_guest_name,
        p_guest_phone,
        p_requests,
        p_guest_details,
        'PENDING',
        NOW()
    )
    RETURNING id INTO v_reservation_id;
    
    -- 5. 성공 반환
    RETURN json_build_object(
        'success', true,
        'reservation_id', v_reservation_id,
        'message', '예약이 성공적으로 생성되었습니다.'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', 'DB_ERROR',
        'message', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION create_reservation_safe(
    UUID, TEXT, DATE, DATE, INT, INT, INT, NUMERIC, TEXT, TEXT, TEXT, JSONB
) TO authenticated, anon;
