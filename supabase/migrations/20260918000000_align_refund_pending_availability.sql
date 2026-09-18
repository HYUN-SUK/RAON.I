-- =====================================================
-- 11월 예약 오픈 대비 취소 즉시 빈자리 전환 일치화 (REFUND_PENDING)
-- 2026-09-18
-- 
-- 목적:
-- 1) 고객이 취소 신청 시 상태가 'REFUND_PENDING'(환불 대기)이 되며,
--    관리자가 환불 송금을 완료하기 전이라도 해당 일정이 즉시 타인에게 오픈되도록
--    DB 제약조건(Exclusion Constraint) 및 create_reservation_safe RPC, get_public_reservations RPC를 전수 일치화함.
-- 2) 퇴실일 당일 입실 허용 및 체류일 중복 불가 공식 엄격 보존
-- 3) 관리자 blocked_dates(차단일/대관)에 대한 DB 철벽 방어 로직 100% 보존
-- =====================================================

-- 1. btree_gist 확장 활성화 확인
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. PostgreSQL 물리적 배제 제약조건(Exclusion Constraint) 갱신
-- 기존 ('CANCELLED', 'REFUNDED') 제외에서 'REFUND_PENDING'도 제외 목록에 추가
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS exclude_overlapping_reservations;

ALTER TABLE reservations 
ADD CONSTRAINT exclude_overlapping_reservations 
EXCLUDE USING gist (
    site_id WITH =,
    daterange(check_in_date, check_out_date, '[)') WITH &&
) WHERE (status NOT IN ('CANCELLED', 'REFUNDED', 'REFUND_PENDING'));

-- 3. create_reservation_safe RPC 고도화 (REFUND_PENDING 빈자리 전환 및 직렬화 락 유지)
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
    
    -- 3-1. 기존 웹 예약(reservations) 중복 검사
    -- CANCELLED, REFUNDED 뿐만 아니라 환불 대기(REFUND_PENDING) 상태도 제외하여 취소 즉시 오픈 보장
    SELECT COUNT(*) INTO v_existing_count
    FROM reservations
    WHERE site_id = p_site_id
      AND status NOT IN ('CANCELLED', 'REFUNDED', 'REFUND_PENDING')
      AND check_in_date < p_check_out
      AND check_out_date > p_check_in;
    
    IF v_existing_count > 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'ALREADY_BOOKED',
            'message', '죄송합니다. 이미 예약이 완료된 날짜입니다.'
        );
    END IF;

    -- 3-2. 관리자 차단일/대관(blocked_dates) 중복 검사 (철벽 방어 유지 & 에어컨 대표카드 연동)
    SELECT COUNT(*) INTO v_existing_count
    FROM blocked_dates
    WHERE (
        site_id = p_site_id 
        OR site_id = 'ALL'
        OR (p_site_id LIKE 'air-%' AND site_id = 'air-group')
      )
      AND start_date < p_check_out
      AND end_date > p_check_in;

    IF v_existing_count > 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'ALREADY_BOOKED',
            'message', '죄송합니다. 관리자 차단 또는 대관으로 예약이 불가한 날짜입니다.'
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

GRANT EXECUTE ON FUNCTION create_reservation_safe(
    UUID, TEXT, DATE, DATE, INT, INT, INT, NUMERIC, TEXT, TEXT, TEXT, JSONB
) TO authenticated, anon;

-- 4. get_public_reservations 공개 조회 RPC 갱신 (REFUND_PENDING 제외)
CREATE OR REPLACE FUNCTION get_public_reservations(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  site_id TEXT,
  check_in_date DATE,
  check_out_date DATE,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY

  -- 1) 웹 예약 (REFUND_PENDING도 제외하여 달력/사이트 목록에서 즉시 빈자리로 표출)
  SELECT r.site_id, r.check_in_date, r.check_out_date, r.status
  FROM reservations r
  WHERE r.status NOT IN ('CANCELLED', 'REFUNDED', 'REFUND_PENDING')
    AND r.check_out_date > p_start_date
    AND r.check_in_date < p_end_date

  UNION ALL

  -- 2) 관리자 차단/수동 예약 (차단 유지)
  SELECT 
    CASE 
      WHEN b.site_id = 'ALL' THEN unnested_sites.site_id
      ELSE b.site_id
    END AS site_id,
    b.start_date AS check_in_date, 
    b.end_date AS check_out_date,
    'BLOCKED'::TEXT AS status
  FROM blocked_dates b
  LEFT JOIN LATERAL (
    SELECT unnest(ARRAY['site-1', 'site-2', 'site-3', 'site-4', 'site-5', 'site-6', 'site-7', 'site-8']) AS site_id
  ) unnested_sites ON b.site_id = 'ALL'
  WHERE b.end_date > p_start_date
    AND b.start_date < p_end_date;

END;
$$;

GRANT EXECUTE ON FUNCTION get_public_reservations(DATE, DATE) TO anon, authenticated;
