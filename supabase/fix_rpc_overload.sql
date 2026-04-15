-- ============================================================
-- [v11.9.9 Hotfix] 함수 오버로드 충돌 해결
-- 기존 p_include_closed 파라미터가 있는 버전을 제거합니다.
-- ============================================================
-- Supabase Dashboard → SQL Editor에서 실행해 주세요.
-- ============================================================

-- 1. 기존 오버로드 함수(p_include_closed 포함) 삭제
DROP FUNCTION IF EXISTS get_master_places_in_radius_v2(
    double precision, double precision, double precision, text, integer, boolean
);

-- 2. 확인: 남은 함수가 1개인지 체크
-- SELECT proname, pronargs, proargnames FROM pg_proc WHERE proname = 'get_master_places_in_radius_v2';
