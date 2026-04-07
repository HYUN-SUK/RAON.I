-- [20260404100000] Implement is_active column and update RPCs
-- 1. Add Columns to master tables
ALTER TABLE public.master_places ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.master_places_gas ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Migrate existing status (Cleanup baseline)
UPDATE public.master_places SET is_active = false WHERE trust_score = 0;
UPDATE public.master_places_gas SET is_active = false WHERE trust_score = 0;

-- 3. Create Index for performance
CREATE INDEX IF NOT EXISTS idx_master_places_is_active ON public.master_places(is_active) WHERE is_active = true;

-- 4. Update get_master_places_in_radius (v1)
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
  distance_meters DOUBLE PRECISION,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id, m.api_source, m.category, m.name, m.description, m.address, 
    m.lat, m.lng, m.trust_score, m.raw_data,
    ST_Distance(m.location::geography, ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography) AS distance_meters,
    m.is_active
  FROM 
    public.master_places m
  WHERE 
    (p_category IS NULL OR m.category = p_category)
    AND (m.is_active IS TRUE)
    AND ST_DWithin(m.location::geography, ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography, radius_meters)
  ORDER BY 
    m.trust_score DESC, 
    distance_meters ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- 5. Update get_master_places_in_radius_v2 (v2)
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
  distance_meters DOUBLE PRECISION,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id, m.api_source, m.category, m.name, m.description, m.address, 
    m.lat, m.lng, m.trust_score, m.raw_data,
    ST_Distance(m.location::geography, ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography) AS distance_meters,
    m.is_active
  FROM 
    public.master_places m
  WHERE 
    (p_category IS NULL OR m.category = p_category)
    AND (p_include_closed IS TRUE OR m.is_active IS TRUE)
    AND ST_DWithin(m.location::geography, ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography, radius_meters)
  ORDER BY 
    m.trust_score DESC, 
    distance_meters ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
