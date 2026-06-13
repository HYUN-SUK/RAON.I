-- 1. Create RLS Policies for authenticated users on travel_recipes
DROP POLICY IF EXISTS "Allow authenticated user all access on recipes" ON public.travel_recipes;
CREATE POLICY "Allow authenticated user all access on recipes" 
ON public.travel_recipes 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 2. Create RLS Policies for authenticated users on travel_recipe_categories
DROP POLICY IF EXISTS "Allow authenticated user all access on categories" ON public.travel_recipe_categories;
CREATE POLICY "Allow authenticated user all access on categories" 
ON public.travel_recipe_categories 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 3. Trigger PostgREST Schema Cache Reload
NOTIFY pgrst, 'reload schema';
