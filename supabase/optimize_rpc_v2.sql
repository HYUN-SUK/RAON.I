-- ============================================================
-- [v11.9.9] get_master_places_in_radius_v2 성능 최적화
-- Bounding Box 프리필터 추가 → 7만건 풀스캔 방지
-- ============================================================
-- 실행 방법: Supabase Dashboard → SQL Editor → 붙여넣기 후 Run
-- ============================================================

-- 기존 함수 교체 (CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION get_master_places_in_radius_v2(
    target_lat double precision,
    target_lng double precision,
    radius_meters double precision,
    p_category text,
    limit_count integer DEFAULT 1000
)
RETURNS TABLE (
    id uuid,
    api_source text,
    category text,
    name text,
    description text,
    address text,
    lat double precision,
    lng double precision,
    trust_score integer,
    raw_data jsonb,
    distance_meters double precision,
    is_active boolean
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    -- 바운딩 박스 계산용 상수 (1도 ≈ 111km)
    lat_delta double precision := radius_meters / 111000.0;
    lng_delta double precision := radius_meters / (111000.0 * cos(radians(target_lat)));
BEGIN
    RETURN QUERY
    SELECT
        mp.id,
        mp.api_source,
        mp.category,
        mp.name,
        mp.description,
        mp.address,
        mp.lat,
        mp.lng,
        mp.trust_score,
        mp.raw_data,
        -- Haversine 거리 계산 (미터 단위)
        (6371000 * acos(
            LEAST(1.0, 
                cos(radians(target_lat)) * cos(radians(mp.lat)) *
                cos(radians(mp.lng) - radians(target_lng)) +
                sin(radians(target_lat)) * sin(radians(mp.lat))
            )
        )) AS distance_meters,
        mp.is_active
    FROM master_places mp
    WHERE mp.category = p_category
      AND mp.is_active = true
      -- [v11.9.9 핵심] Bounding Box 프리필터: 인덱스 활용하여 후보 대폭 축소
      AND mp.lat BETWEEN (target_lat - lat_delta) AND (target_lat + lat_delta)
      AND mp.lng BETWEEN (target_lng - lng_delta) AND (target_lng + lng_delta)
      -- 좌표 유효성 검증 (0,0 데이터 제외)
      AND mp.lat != 0 AND mp.lng != 0
    ORDER BY distance_meters ASC
    LIMIT limit_count;
END;
$$;

-- 성능 최적화를 위한 복합 인덱스 생성 (이미 존재하면 무시)
CREATE INDEX IF NOT EXISTS idx_master_places_cat_active_lat_lng 
ON master_places (category, is_active, lat, lng);

-- ============================================================
-- 검증 쿼리: 철수네 캠핑장(충남 예산) 반경 30km RESTAURANT 조회
-- 이 쿼리의 결과가 1000건 이상이면 성공
-- ============================================================
-- SELECT count(*) FROM get_master_places_in_radius_v2(
--     36.626909, 126.7647868, 30000, 'RESTAURANT', 1000
-- );
