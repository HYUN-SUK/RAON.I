-- [20260422154400] Add Prestige Landmark table and Master protection
-- 1. Add is_protected column to master_places
ALTER TABLE public.master_places ADD COLUMN IF NOT EXISTS is_protected BOOLEAN DEFAULT false;

-- 2. Create index for protected places
CREATE INDEX IF NOT EXISTS idx_master_places_is_protected ON public.master_places(is_protected) WHERE is_protected = true;

-- 3. Create prestige_landmarks table
CREATE TABLE IF NOT EXISTS public.prestige_landmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    master_id UUID REFERENCES public.master_places(id) ON DELETE SET NULL,
    tier INTEGER NOT NULL CHECK (tier IN (1, 2)),
    source TEXT NOT NULL, -- 'TOURISM_100', 'REGIONAL_SCENERY'
    sido TEXT NOT NULL,
    sigungu TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    lat NUMERIC,
    lng NUMERIC,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create indexes for prestige_landmarks
CREATE INDEX IF NOT EXISTS idx_prestige_landmarks_tier ON public.prestige_landmarks(tier);
CREATE INDEX IF NOT EXISTS idx_prestige_landmarks_sigungu ON public.prestige_landmarks(sigungu);
CREATE INDEX IF NOT EXISTS idx_prestige_landmarks_name ON public.prestige_landmarks(name);
CREATE INDEX IF NOT EXISTS idx_prestige_landmarks_master_id ON public.prestige_landmarks(master_id);

-- 5. Add comment
COMMENT ON TABLE public.prestige_landmarks IS '전국 명성 랜드마크 (Tier 1: 한국관광 100선, Tier 2: 지역 8경/10경)';
