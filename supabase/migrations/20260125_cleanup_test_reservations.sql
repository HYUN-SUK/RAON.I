-- Migration: 20260125_cleanup_test_reservations.sql
-- Purpose: 취소됨/환불완료 상태의 테스트 예약 데이터 정리
-- Date: 2026-01-24
-- Note: 이 파일은 Supabase SQL Editor에서 수동 실행 필요

-- 1. 삭제 전 현황 확인
SELECT 
    status,
    COUNT(*) as count,
    MIN(created_at) as oldest,
    MAX(created_at) as newest
FROM reservations
WHERE status IN ('cancelled', 'refunded')
GROUP BY status;

-- 2. 삭제 대상 미리보기
SELECT 
    id,
    site_id,
    status,
    check_in,
    check_out,
    total_price,
    created_at
FROM reservations
WHERE status IN ('cancelled', 'refunded')
ORDER BY created_at ASC;

-- 3. 실제 삭제 (위 확인 후 실행)
-- ⚠️ 아래 DELETE 문은 주석 해제 후 실행하세요!
-- DELETE FROM reservations
-- WHERE status IN ('cancelled', 'refunded');

-- 4. 삭제 후 확인
-- SELECT COUNT(*) as remaining FROM reservations;
