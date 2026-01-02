-- Create Weather Cache Table for KMA API
-- Caches weather data by Grid Coordinates (nx, ny) to minimize API calls

CREATE TABLE IF NOT EXISTS public.weather_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nx INTEGER NOT NULL,
    ny INTEGER NOT NULL,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique cache per grid cell
    UNIQUE(nx, ny)
);

-- Enable RLS (though server-side mostly uses Service Role, good practice)
ALTER TABLE public.weather_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read (if needed by client) or service role only
-- For now, let's allow read for authenticated to be safe, but mostly handled by API route
CREATE POLICY "Allow public read of weather cache" ON public.weather_cache
    FOR SELECT TO public USING (true);

-- Allow service role full access (default, but explicit verification)
