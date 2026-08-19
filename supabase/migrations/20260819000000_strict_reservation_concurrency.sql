-- =====================================================
-- 예약 동시성 제어 및 이중 예약(Double Booking) 원천 방어 강화
-- 2026-08-19
-- 
-- 목적: 1) btree_gist 확장을 통한 물리적 배제 제약조건(Exclusion Constraint) 장착
--       2) create_reservation_safe RPC의 사이트 단위 직렬화 락 고도화
-- =====================================================

-- 1. btree_gist 확장 활성화
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. 기존 제약조건이 있다면 안전하게 삭제 후 재생성
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS exclude_overlapping_reservations;

ALTER TABLE reservations 
ADD CONSTRAINT exclude_overlapping_reservations 
EXCLUDE USING gist (
    site_id WITH =,
    daterange(check_in_date, check_out_date, '[)') WITH &&
) WHERE (status NOT IN ('CANCELLED', 'REFUNDED'));

-- 3. create_reservation_safe RPC 고도화 (사이트 단위 락 + 완벽한 예외 처리)
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
    -- 1. Lock Key: 사이트 단위로 락 키 생성하여 동일 사이트에 대한 모든 요청 직렬화
    v_lock_key := hashtext('site_lock_' || p_site_id);
    
    -- 2. Advisory Lock 획득 (트랜잭션 종료 시 자동 해제)
    IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'CONCURRENT_REQUEST',
            'message', '해당 사이트에 대한 다른 예약이 처리 중입니다. 잠시 후 다시 시도해주세요.'
        );
    END IF;
    
    -- 3. 중복 예약 확인 (날짜 범위 겹침 검사)
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
    
    -- 4. 예약 생성
    v_nights := p_check_out - p_check_in;
    
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
    
EXCEPTION 
    WHEN exclusion_violation THEN
        -- DB 물리적 배제 제약조건에 의해 차단된 경우
        RETURN json_build_object(
            'success', false,
            'error', 'ALREADY_BOOKED',
            'message', '죄송합니다. 다른 사용자가 방금 해당 일정을 선점하셨습니다.'
        );
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'DB_ERROR',
            'message', SQLERRM
        );
END;
$$;

-- 권한 부여
GRANT EXECUTE ON FUNCTION create_reservation_safe(
    UUID, TEXT, DATE, DATE, INT, INT, INT, NUMERIC, TEXT, TEXT, TEXT, JSONB
) TO authenticated, anon;
