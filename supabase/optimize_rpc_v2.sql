-- [v11913] Quality-First Smart Camping 1st Quota RPC
-- 정렬 기준: 인기도/품질 점수 DESC -> 거리 ASC
CREATE OR REPLACE FUNCTION get_master_places_in_radius_v11913(
    target_lat double precision,
    target_lng double precision,
    radius_meters double precision,
    p_category text,
    limit_count integer DEFAULT 1000
)
RETURNS TABLE (
    id uuid,
    category text,
    api_source text,
    name text,
    address text,
    lat double precision,
    lng double precision,
    trust_score integer,
    raw_data jsonb,
    distance_meters double precision,
    is_active boolean
) 
LANGUAGE plpgsql
AS $$
DECLARE
    lat_delta double precision;
    lng_delta double precision;
BEGIN
    -- 1도당 거리는 대략 111km, 위도에 비례하여 경도 오차 보정
    lat_delta := radius_meters / 111000.0;
    lng_delta := radius_meters / (111000.0 * cos(radians(target_lat)));

    RETURN QUERY
    SELECT 
        mp.id, mp.category, mp.api_source, mp.name, mp.address, 
        mp.lat, mp.lng, mp.trust_score, mp.raw_data,
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
      AND mp.lat BETWEEN (target_lat - lat_delta) AND (target_lat + lat_delta)
      AND mp.lng BETWEEN (target_lng - lng_delta) AND (target_lng + lng_delta)
      AND mp.lat != 0 AND mp.lng != 0
      AND (6371000 * acos(
            LEAST(1.0, 
                cos(radians(target_lat)) * cos(radians(mp.lat)) *
                cos(radians(mp.lng) - radians(target_lng)) +
                sin(radians(target_lat)) * sin(radians(mp.lat))
            )
        )) <= radius_meters
    ORDER BY 
        (CASE 
            WHEN p_category = 'SPOT' THEN COALESCE((mp.raw_data->'popularity_v2'->>'base_pop')::double precision, 0)
            ELSE mp.trust_score::double precision
        END) DESC,
        distance_meters ASC
    LIMIT limit_count;
END;
$$;
