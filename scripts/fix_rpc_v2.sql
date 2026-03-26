-- RPC v2: get_master_places_in_radius_v2
-- Resolves signature ambiguity and adds p_include_closed filter

CREATE OR REPLACE FUNCTION get_master_places_in_radius_v2(
  target_lat DOUBLE PRECISION,
  target_lng DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION,
  p_category TEXT DEFAULT NULL,
  limit_count INTEGER DEFAULT 50,
  p_include_closed BOOLEAN DEFAULT FALSE
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
    AND (p_include_closed IS TRUE OR m.trust_score > 0) -- Filter out trust_score 0 (Closed)
    AND ST_DWithin(m.location::geography, ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography, radius_meters)
  ORDER BY 
    m.trust_score DESC, 
    distance_meters ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
