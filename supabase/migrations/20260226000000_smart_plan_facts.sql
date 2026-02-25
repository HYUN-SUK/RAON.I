-- 1. Enable PostGIS extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;

-- 2. Create the smart_plan_facts table
CREATE TABLE IF NOT EXISTS public.smart_plan_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_source TEXT NOT NULL,         -- e.g., 'NMC_HOSPITAL', 'ADMIN_MART', 'TOUR_API', 'OPINET', 'SMBA_RESTAURANT', 'SAFE_RESTAURANT', 'GOOD_RESTAURANT'
    category TEXT NOT NULL,           -- 'MART_HOSPITAL', 'RESTAURANT', 'SPOT', 'FESTIVAL', 'ROUTE_CAFE'
    name TEXT NOT NULL,               -- e.g., '호수 뷰 하나로마트', '예산 소복갈비'
    description TEXT,                 -- Short description or context
    address TEXT,                     -- Full physical address
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    geom geometry(Point, 4326),       -- Spatial column for fast radius search
    raw_data JSONB DEFAULT '{}'::jsonb, -- Original API properties (dutyTime, cat3, etc.)
    trust_score INTEGER DEFAULT 0,    -- Base weight/trust score (e.g., +20 for good_restaurant)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Trigger for updating updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_smart_plan_facts_updated_at ON public.smart_plan_facts;
CREATE TRIGGER set_smart_plan_facts_updated_at
BEFORE UPDATE ON public.smart_plan_facts
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 4. Trigger for automatically setting the geom column when inserting/updating lat and lng
CREATE OR REPLACE FUNCTION public.smart_plan_facts_geom_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Set SRID to 4326 (WGS 84). Note: PostGIS ST_MakePoint takes (longitude, latitude)
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_smart_plan_facts_geom_update ON public.smart_plan_facts;
CREATE TRIGGER trig_smart_plan_facts_geom_update
BEFORE INSERT OR UPDATE OF lat, lng ON public.smart_plan_facts
FOR EACH ROW
EXECUTE FUNCTION public.smart_plan_facts_geom_update();

-- 5. Create spatial index for blazing fast radius queries
CREATE INDEX IF NOT EXISTS smart_plan_facts_geom_idx ON public.smart_plan_facts USING GIST (geom);
CREATE INDEX IF NOT EXISTS smart_plan_facts_category_idx ON public.smart_plan_facts (category);
CREATE INDEX IF NOT EXISTS smart_plan_facts_api_source_idx ON public.smart_plan_facts (api_source);

-- 6. Enable RLS
ALTER TABLE public.smart_plan_facts ENABLE ROW LEVEL SECURITY;

-- 7. Policies: Anyone can read, only Service Role (Admin/Cron) can insert/update/delete
CREATE POLICY "Public profiles are viewable by everyone."
ON public.smart_plan_facts FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Service role can perform all actions."
ON public.smart_plan_facts FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 8. RPC Function for searching facts within a specific radius
-- Usage: supabase.rpc('get_smart_plan_facts_in_radius', { center_lat: 37.5, center_lng: 127.0, radius_meters: 15000 })
CREATE OR REPLACE FUNCTION public.get_smart_plan_facts_in_radius(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION
)
RETURNS SETOF public.smart_plan_facts
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.smart_plan_facts
  WHERE ST_DWithin(
    geom::geography, -- Cast to geography for accurate distance calculation in meters
    ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
    radius_meters
  )
  ORDER BY geom <-> ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geometry;
$$;
