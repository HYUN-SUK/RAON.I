-- 공개 예약 현황 조회 RPC
-- 민감 정보를 제외하고 예약된 사이트와 날짜만 반환합니다.

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
  SELECT r.site_id, r.check_in_date, r.check_out_date, r.status
  FROM reservations r
  WHERE r.status NOT IN ('CANCELLED', 'REFUNDED')
    AND r.check_out_date > p_start_date
    AND r.check_in_date < p_end_date;
END;
$$;

-- 익명 사용자(anon)와 인증된 사용자(authenticated) 모두 실행 가능
GRANT EXECUTE ON FUNCTION get_public_reservations(DATE, DATE) TO anon, authenticated;
