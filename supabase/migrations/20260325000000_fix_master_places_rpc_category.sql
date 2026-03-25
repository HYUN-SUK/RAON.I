-- Fix: get_master_places_in_radius RPC에 p_category 파라미터 추가
-- 기존 RPC는 카테고리 필터 없이 전체 데이터를 trust_score 순으로 반환하여
-- RESTAURANT가 항상 상위를 독점하는 문제가 있었음.
-- 이 마이그레이션으로 p_category 필터를 추가하여 카테고리별 정확한 조회를 지원합니다.

CREATE OR REPLACE FUNCTION get_master_places_in_radius(
  target_lat DOUBLE PRECISION,
  target_lng DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION,
  p_category TEXT DEFAULT NULL,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  api_source TEXT,
  category TEXT,
  name TEXT,
  description TEXT,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  trust_score INTEGER,
  raw_data JSONB,
  distance_meters DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id, m.api_source, m.category, m.name, m.description, m.address, 
    m.lat, m.lng, m.trust_score, m.raw_data,
    ST_Distance(m.location::geography, ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography) AS distance_meters
  FROM 
    public.master_places m
  WHERE 
    (p_category IS NULL OR m.category = p_category)
    AND ST_DWithin(m.location::geography, ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography, radius_meters)
  ORDER BY 
    m.trust_score DESC, 
    distance_meters ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
