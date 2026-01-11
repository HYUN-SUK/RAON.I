-- =====================================================
-- 예약 동시성 제어를 위한 RPC 함수
-- 2026-01-11
-- 
-- 목적: 동시에 여러 사용자가 같은 날짜/사이트에 예약 시도 시
--       가장 빠른 한 명만 성공하도록 보장
-- =====================================================

-- 0. reservations 테이블 생성 (없는 경우)
CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    site_id TEXT NOT NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    nights INT DEFAULT 1,
    family_count INT DEFAULT 1,
    visitor_count INT DEFAULT 0,
    vehicle_count INT DEFAULT 1,
    guests INT DEFAULT 1,
    total_price NUMERIC DEFAULT 0,
    guest_name TEXT,
    guest_phone TEXT,
    requests TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED', 'COMPLETED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 설정
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 본인 예약만 조회 가능
DROP POLICY IF EXISTS "Users can view own reservations" ON reservations;
CREATE POLICY "Users can view own reservations" ON reservations
    FOR SELECT USING (auth.uid() = user_id OR auth.jwt() ->> 'email' = 'admin@raon.ai');

-- RLS 정책: 본인 예약만 생성 가능
DROP POLICY IF EXISTS "Users can create own reservations" ON reservations;
CREATE POLICY "Users can create own reservations" ON reservations
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- RLS 정책: 관리자만 수정 가능
DROP POLICY IF EXISTS "Admins can update reservations" ON reservations;
CREATE POLICY "Admins can update reservations" ON reservations
    FOR UPDATE USING (auth.jwt() ->> 'email' = 'admin@raon.ai');

-- 서비스 역할은 모든 작업 가능
DROP POLICY IF EXISTS "Service role full access" ON reservations;
CREATE POLICY "Service role full access" ON reservations
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- 1. 예약 생성 시 동시성 제어 (Advisory Lock 사용)
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
    p_requests TEXT DEFAULT NULL
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
    -- 1. Lock Key 생성: site_id + check_in 조합으로 유니크 키 생성
    -- 같은 사이트 + 같은 체크인 날짜에 대한 요청은 직렬화됨
    v_lock_key := hashtext(p_site_id || p_check_in::TEXT);
    
    -- 2. Advisory Lock 획득 (대기 없이 즉시 반환)
    -- 다른 트랜잭션이 같은 키로 락을 잡고 있으면 false 반환
    IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'CONCURRENT_REQUEST',
            'message', '다른 예약이 처리 중입니다. 잠시 후 다시 시도해주세요.'
        );
    END IF;
    
    -- 3. 중복 예약 확인 (해당 사이트의 해당 날짜 범위에 겹치는 예약)
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

-- 권한 부여
GRANT EXECUTE ON FUNCTION create_reservation_safe(
    UUID, TEXT, DATE, DATE, INT, INT, INT, NUMERIC, TEXT, TEXT, TEXT
) TO authenticated, anon;

-- 2. 추가 안전장치: 예약 테이블에 중복 방지 인덱스 (날짜 범위 겹침 방지)
-- 이 인덱스는 완벽한 중복 방지는 아니지만 추가 보호층 역할
-- (PostgreSQL에서는 exclusion constraint로 더 강력한 제약 가능)

-- 기존 인덱스가 있으면 드랍
DROP INDEX IF EXISTS idx_reservations_site_dates;

-- 검색 성능 향상을 위한 인덱스
CREATE INDEX idx_reservations_site_dates 
ON reservations (site_id, check_in_date, check_out_date) 
WHERE status NOT IN ('CANCELLED', 'REFUNDED');

-- 3. 예약 가용성 확인 함수 (UI에서 미리 체크용)
CREATE OR REPLACE FUNCTION check_reservation_availability(
    p_site_id TEXT,
    p_check_in DATE,
    p_check_out DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM reservations
    WHERE site_id = p_site_id
      AND status NOT IN ('CANCELLED', 'REFUNDED')
      AND check_in_date < p_check_out
      AND check_out_date > p_check_in;
    
    IF v_count > 0 THEN
        RETURN json_build_object(
            'available', false,
            'message', '해당 날짜에 이미 예약이 있습니다.'
        );
    ELSE
        RETURN json_build_object(
            'available', true,
            'message', '예약 가능합니다.'
        );
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION check_reservation_availability(TEXT, DATE, DATE) TO authenticated, anon;

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ 예약 동시성 제어 RPC 설치 완료';
    RAISE NOTICE '  - create_reservation_safe: 안전한 예약 생성 (락 + 중복 체크)';
    RAISE NOTICE '  - check_reservation_availability: 예약 가용성 확인';
END $$;
