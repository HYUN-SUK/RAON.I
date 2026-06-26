-- 공개 예약 현황 조회 RPC
-- 민감 정보를 제외하고 예약된 사이트와 날짜만 반환합니다.
-- 관리자 차단(blocked_dates)도 포함하여 사용자 예약화면에서 마감 처리합니다.

DROP FUNCTION IF EXISTS get_public_reservations(DATE, DATE) CASCADE;
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

  -- 1) 웹 예약 (기존 로직 유지)
  SELECT r.site_id, r.check_in_date, r.check_out_date, r.status
  FROM reservations r
  WHERE r.status NOT IN ('CANCELLED', 'REFUNDED')
    AND r.check_out_date > p_start_date
    AND r.check_in_date < p_end_date

  UNION ALL

  -- 2) 관리자 차단/수동 예약 (신규 추가)
  SELECT b.site_id, b.start_date AS check_in_date, b.end_date AS check_out_date,
         'BLOCKED'::TEXT AS status
  FROM blocked_dates b
  WHERE b.end_date > p_start_date
    AND b.start_date < p_end_date;

END;
$$;

-- 익명 사용자(anon)와 인증된 사용자(authenticated) 모두 실행 가능
GRANT EXECUTE ON FUNCTION get_public_reservations(DATE, DATE) TO anon, authenticated;
