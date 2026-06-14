-- 1. Create travel_play_categories Table
CREATE TABLE IF NOT EXISTS public.travel_play_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    parent_id BIGINT REFERENCES public.travel_play_categories(id) ON DELETE CASCADE,
    icon_emoji VARCHAR(10),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Index for parent category lookups
CREATE INDEX IF NOT EXISTS idx_travel_play_categories_parent ON public.travel_play_categories(parent_id);

-- 2. Create travel_plays Table
CREATE TABLE IF NOT EXISTS public.travel_plays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id BIGINT REFERENCES public.travel_play_categories(id) ON DELETE SET NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    thumbnail_url TEXT,
    difficulty INT DEFAULT 1,
    time_required INT DEFAULT 15,
    materials TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    process_steps TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    tips TEXT,
    age_group VARCHAR(50),
    view_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Index for category-based filtering
CREATE INDEX IF NOT EXISTS idx_travel_plays_category ON public.travel_plays(category_id);

-- 3. Enable RLS
ALTER TABLE public.travel_play_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_plays ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for travel_play_categories
CREATE POLICY "Allow public read access on play categories" 
ON public.travel_play_categories 
FOR SELECT 
USING (true);

CREATE POLICY "Allow full access for authenticated users on play categories" 
ON public.travel_play_categories 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow full access for service role on play categories" 
ON public.travel_play_categories 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- 5. Create RLS Policies for travel_plays
CREATE POLICY "Allow public read access on plays" 
ON public.travel_plays 
FOR SELECT 
USING (true);

CREATE POLICY "Allow full access for authenticated users on plays" 
ON public.travel_plays 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow full access for service role on plays" 
ON public.travel_plays 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- 6. Trigger PostgREST Schema Cache Reload
NOTIFY pgrst, 'reload schema';
