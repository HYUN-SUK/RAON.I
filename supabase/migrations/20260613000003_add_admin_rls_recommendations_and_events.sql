-- 1. Create RLS Policies for authenticated users on recommendation_pool
DROP POLICY IF EXISTS "Allow authenticated user all access on recommendation_pool" ON public.recommendation_pool;
CREATE POLICY "Allow authenticated user all access on recommendation_pool" 
ON public.recommendation_pool 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 2. Create RLS Policies for authenticated users on nearby_events
DROP POLICY IF EXISTS "Allow authenticated user all access on nearby_events" ON public.nearby_events;
CREATE POLICY "Allow authenticated user all access on nearby_events" 
ON public.nearby_events 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 3. Trigger PostgREST Schema Cache Reload
NOTIFY pgrst, 'reload schema';
