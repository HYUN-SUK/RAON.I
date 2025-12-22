-- Mission System Migration
-- 1. Missions Table
CREATE TABLE IF NOT EXISTS public.missions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    mission_type TEXT NOT NULL CHECK (mission_type IN ('PHOTO', 'CHECKIN', 'COMMUNITY')),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    reward_xp INTEGER DEFAULT 0,
    reward_point INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. User Missions (Participation)
CREATE TABLE IF NOT EXISTS public.user_missions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE,
    content TEXT, -- Optional text content for the mission
    image_url TEXT, -- Proof image
    status TEXT DEFAULT 'PARTICIPATING' CHECK (status IN ('PARTICIPATING', 'COMPLETED', 'CLAIMED')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, mission_id)
);

-- 3. Point History (Rewards)
CREATE TABLE IF NOT EXISTS public.point_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL, -- e.g., 'MISSION_REWARD', 'EVENT'
    related_mission_id UUID REFERENCES public.missions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_history ENABLE ROW LEVEL SECURITY;

-- Missions: Readable by everyone, Insert/Update by Service Role (Admin)
DROP POLICY IF EXISTS "Missions are viewable by everyone" ON public.missions;
CREATE POLICY "Missions are viewable by everyone" ON public.missions
    FOR SELECT USING (true);

-- User Missions: Users can view/insert their own
DROP POLICY IF EXISTS "Users can view own mission progress" ON public.user_missions;
CREATE POLICY "Users can view own mission progress" ON public.user_missions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can join missions" ON public.user_missions;
CREATE POLICY "Users can join missions" ON public.user_missions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own mission" ON public.user_missions;
CREATE POLICY "Users can update own mission" ON public.user_missions
    FOR UPDATE USING (auth.uid() = user_id);

-- Point History: Users can view their own
DROP POLICY IF EXISTS "Users can view own points" ON public.point_history;
CREATE POLICY "Users can view own points" ON public.point_history
    FOR SELECT USING (auth.uid() = user_id);
    
-- Add some seed data for testing (Check for duplicates)
INSERT INTO public.missions (title, description, mission_type, start_date, end_date, reward_xp, reward_point)
SELECT '겨울 캠핑의 묘미, 불멍 인증', '타닥타닥 타오르는 불멍 사진을 올려주세요. 따뜻한 코코아 한 잔도 좋아요!', 'PHOTO', NOW() - INTERVAL '1 day', NOW() + INTERVAL '6 days', 100, 500
WHERE NOT EXISTS (
    SELECT 1 FROM public.missions WHERE title = '겨울 캠핑의 묘미, 불멍 인증'
);
