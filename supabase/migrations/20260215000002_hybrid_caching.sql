-- 20260214_hybrid_caching.sql

-- 1. Nearby Cache Table (Tourism API - Nationwide Prefetch)
CREATE TABLE IF NOT EXISTS public.nearby_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_code TEXT NOT NULL, -- 'ALL' for nationwide, or specific region code
    base_date TEXT NOT NULL,   -- 'YYYYMMDD'
    data JSONB NOT NULL,       -- List of events
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Constraint: Only one cache per region per day
    CONSTRAINT nearby_cache_region_date_key UNIQUE (region_code, base_date)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_nearby_cache_lookup ON public.nearby_cache (region_code, base_date);

-- 2. Weather Cache Optimization (Weather API - On-demand Lazy Caching)
-- Ensure the table exists (it might already exist from previous phases)
CREATE TABLE IF NOT EXISTS public.weather_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nx INTEGER NOT NULL,
    ny INTEGER NOT NULL,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    CONSTRAINT weather_cache_nx_ny_key UNIQUE (nx, ny)
);

-- Add index for Grid lookup if not exists
CREATE INDEX IF NOT EXISTS idx_weather_cache_grid ON public.weather_cache (nx, ny);

-- Enable RLS (but allow public read/service role write)
ALTER TABLE public.nearby_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_cache ENABLE ROW LEVEL SECURITY;

-- Policies for Nearby Cache
DROP POLICY IF EXISTS "Public read nearby cache" ON public.nearby_cache;
CREATE POLICY "Public read nearby cache"
ON public.nearby_cache FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Service role insert/update nearby cache" ON public.nearby_cache;
CREATE POLICY "Service role insert/update nearby cache"
ON public.nearby_cache FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Policies for Weather Cache
DROP POLICY IF EXISTS "Public read weather cache" ON public.weather_cache;
CREATE POLICY "Public read weather cache"
ON public.weather_cache FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Service role insert/update weather cache" ON public.weather_cache;
CREATE POLICY "Service role insert/update weather cache"
ON public.weather_cache FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
