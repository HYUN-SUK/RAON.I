-- =====================================================
-- 환불 정책 관리자 설정 기능 추가
-- 2026-01-12
-- 
-- 목적: 관리자가 환불율(D-7, D-6, ... D-Day)을 직접 수정 가능
-- =====================================================

-- 1. site_config 테이블에 refund_policy 컬럼 추가
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS refund_policy JSONB DEFAULT '{
    "d7_plus": 100,
    "d6": 90,
    "d5": 50,
    "d4": 40,
    "d3": 30,
    "d2": 20,
    "d1_day": 0
}'::jsonb;

-- 2. 동적 환불율 계산 함수 (site_config에서 정책 가져오기)
CREATE OR REPLACE FUNCTION calculate_refund_rate(p_check_in_date DATE)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_days_until INT;
    v_policy JSONB;
BEGIN
    v_days_until := p_check_in_date - CURRENT_DATE;
    
    -- site_config에서 환불 정책 가져오기
    SELECT refund_policy INTO v_policy FROM site_config WHERE id = 1;
    
    -- 기본값 설정 (정책이 없는 경우)
    IF v_policy IS NULL THEN
        v_policy := '{
            "d7_plus": 100,
            "d6": 90,
            "d5": 50,
            "d4": 40,
            "d3": 30,
            "d2": 20,
            "d1_day": 0
        }'::jsonb;
    END IF;
    
    -- 환불율 계산
    IF v_days_until <= 1 THEN
        RETURN COALESCE((v_policy->>'d1_day')::int, 0);
    ELSIF v_days_until = 2 THEN
        RETURN COALESCE((v_policy->>'d2')::int, 20);
    ELSIF v_days_until = 3 THEN
        RETURN COALESCE((v_policy->>'d3')::int, 30);
    ELSIF v_days_until = 4 THEN
        RETURN COALESCE((v_policy->>'d4')::int, 40);
    ELSIF v_days_until = 5 THEN
        RETURN COALESCE((v_policy->>'d5')::int, 50);
    ELSIF v_days_until = 6 THEN
        RETURN COALESCE((v_policy->>'d6')::int, 90);
    ELSE
        RETURN COALESCE((v_policy->>'d7_plus')::int, 100);
    END IF;
END;
$$;

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE 'Refund policy admin settings added successfully';
    RAISE NOTICE '  - refund_policy column added to site_config';
    RAISE NOTICE '  - calculate_refund_rate now reads from site_config';
END $$;
