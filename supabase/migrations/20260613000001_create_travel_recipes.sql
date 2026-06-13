-- 1. Create travel_recipe_categories Table
CREATE TABLE IF NOT EXISTS public.travel_recipe_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    parent_id BIGINT REFERENCES public.travel_recipe_categories(id) ON DELETE CASCADE,
    icon_emoji VARCHAR(10),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Index for parent category lookups
CREATE INDEX IF NOT EXISTS idx_travel_recipe_categories_parent ON public.travel_recipe_categories(parent_id);

-- 2. Create travel_recipes Table
CREATE TABLE IF NOT EXISTS public.travel_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id BIGINT REFERENCES public.travel_recipe_categories(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    thumbnail_url TEXT,
    ingredients JSONB NOT NULL,
    travel_tips TEXT[] NOT NULL,
    youtube_search_keyword VARCHAR(150),
    instagram_search_keyword VARCHAR(150),
    view_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Index for category-based filtering
CREATE INDEX IF NOT EXISTS idx_travel_recipes_category ON public.travel_recipes(category_id);

-- 3. Enable RLS
ALTER TABLE public.travel_recipe_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_recipes ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for travel_recipe_categories
CREATE POLICY "Allow public read access on categories" 
ON public.travel_recipe_categories 
FOR SELECT 
USING (true);

CREATE POLICY "Allow full access for service role on categories" 
ON public.travel_recipe_categories 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- 5. Create RLS Policies for travel_recipes
CREATE POLICY "Allow public read access on recipes" 
ON public.travel_recipes 
FOR SELECT 
USING (true);

CREATE POLICY "Allow full access for service role on recipes" 
ON public.travel_recipes 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- 6. Trigger PostgREST Schema Cache Reload (Force Schema Refresh)
NOTIFY pgrst, 'reload schema';
