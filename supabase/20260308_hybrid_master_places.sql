-- 1. Create PostGIS extension if not exists (usually exists on Supabase)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Create the unified table for static master places (RESTAURANT, MART, SPOT)
CREATE TABLE IF NOT EXISTS public.master_places (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_source TEXT NOT NULL,          -- e.g., 'SMBA_BAEK', 'LARGE_STORE', 'TOUR_SPOT'
    category TEXT NOT NULL,            -- 'RESTAURANT', 'MART', 'SPOT'
    name TEXT NOT NULL,
    description TEXT,
    address TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    trust_score INTEGER DEFAULT 0,
    raw_data JSONB,
    sido TEXT,                         -- Optimization: State/Province (e.g. 부산광역시)
    sigungu TEXT,                      -- Optimization: City/District (e.g. 해운대구)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Using PostGIS geometry for ultra-fast radius search
    location geometry(Point, 4326)
);

-- 3. Create a specialized table for Gas Stations (due to seasonal logic and different data shapes)
CREATE TABLE IF NOT EXISTS public.master_places_gas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_source TEXT NOT NULL DEFAULT 'OPINET',
    category TEXT NOT NULL DEFAULT 'GAS_STATION',
    name TEXT NOT NULL,
    description TEXT,
    address TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    trust_score INTEGER DEFAULT 95,
    raw_data JSONB,
    sido TEXT,
    sigungu TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    location geometry(Point, 4326)
);

-- 4. Create PostGIS GIST Indexes for ultra-fast spatial querying
CREATE INDEX IF NOT EXISTS idx_master_places_location ON public.master_places USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_master_places_gas_location ON public.master_places_gas USING GIST (location);

-- Create standard indexes on Category and Region for secondary filtering
CREATE INDEX IF NOT EXISTS idx_master_places_category ON public.master_places(category);
CREATE INDEX IF NOT EXISTS idx_master_places_sigungu ON public.master_places(sido, sigungu);

-- 5. Trigger function to auto-update the 'location' geometry column on insert/update
CREATE OR REPLACE FUNCTION public.update_master_places_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_master_places_location
BEFORE INSERT OR UPDATE ON public.master_places
FOR EACH ROW EXECUTE FUNCTION public.update_master_places_location();

CREATE TRIGGER trg_master_places_gas_location
BEFORE INSERT OR UPDATE ON public.master_places_gas
FOR EACH ROW EXECUTE FUNCTION public.update_master_places_location();

-- 6. RPC Function: The magical 0.1s Fast Query for D-3 Cron / Frontend
-- Finds Top N master places within given meters radius, sorted by trust_score
-- [v11.0 Patch] Changed to NUMERIC for JS/Supabase compatibility & fixed parameter to p_category
CREATE OR REPLACE FUNCTION get_master_places_in_radius(
  target_lat NUMERIC,
  target_lng NUMERIC,
  radius_meters NUMERIC,
  p_category TEXT,
  limit_count INTEGER DEFAULT 300
)
RETURNS SETOF public.master_places
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.master_places
  WHERE category = p_category
    AND ST_DWithin(
      location,
      ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography,
      radius_meters
    )
  ORDER BY trust_score DESC, location <-> ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)
  LIMIT limit_count;
END;
$$;
