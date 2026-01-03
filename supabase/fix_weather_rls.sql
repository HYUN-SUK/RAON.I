-- Allow Service Role (and Authenticated/Anon for now to unblock) FULL access to weather_cache
-- In a real app, API route should use Service Role to bypass RLS, 
-- but 'createClient()' in utils often defaults to user session.

DROP POLICY IF EXISTS "Allow public read of weather cache" ON public.weather_cache;

CREATE POLICY "Allow full access for all" ON public.weather_cache
    FOR ALL
    USING (true)
    WITH CHECK (true);
