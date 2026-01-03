-- Manually apply weather_cache table creation
CREATE TABLE IF NOT EXISTS public.weather_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nx INTEGER NOT NULL,
    ny INTEGER NOT NULL,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(nx, ny)
);

ALTER TABLE public.weather_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read of weather cache" ON public.weather_cache
    FOR SELECT TO public USING (true);
