-- Fix RPC Signature Conflict
DROP FUNCTION IF EXISTS get_master_places_in_radius(double precision, double precision, double precision);
DROP FUNCTION IF EXISTS get_master_places_in_radius(double precision, double precision, double precision, text, integer);

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
